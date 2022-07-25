const pacote = require('pacote')
const path = require('path')
const { Octokit } = require('@octokit/rest')
const { graphql: Graphql } = require('@octokit/graphql')
const glob = require('glob')
const { merge } = require('lodash')
const log = require('proc-log')

const graphqlKey = (k) => `_${k.replace(/[^_0-9A-Za-z]/g, '')}`

const CACHE = new Map()
const cacheMethod = (fn) => {
  CACHE.set(fn, new Map())
  return async (...args) => {
    const key = args.map(JSON.stringify).join()
    if (CACHE.get(fn).has(key)) {
      return CACHE.get(fn).get(key)
    }
    const res = await fn(...args)
    CACHE.get(fn).set(key, res)
    return res
  }
}

module.exports = ({ auth }) => {
  const REST = new Octokit({
    auth,
  })

  const GRAPHQL = Graphql.defaults({
    headers: {
      authorization: `token ${auth}`,
    },
  })

  const PACKAGE = {
    manifest: (spec, opt) => {
      log.verbose(`api:package:manifest`, spec)
      return pacote.manifest(spec, opt).catch(() => null)
    },
    packument: (spec, opt) => {
      log.verbose(`api:package:packument`, spec)
      return pacote.packument(spec, opt).catch(() => null)
    },
    downloads: (name) => {
      log.verbose(`api:package:downloads`, name)
      return fetch(`https://api.npmjs.org/downloads/point/last-month/${name}`)
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null)
    },
  }

  const REPO = {
    get: (owner, repo) => {
      log.verbose(`api:repo:get`, `${owner}/${repo}`)
      return REST.repos.get({ owner, repo }).then(d => d.data)
    },
    /**
     * @returns {Promise<string[]>}
     */
    subTrees: async (owner, name, paths) => {
      log.verbose(`api:repo:subTrees`, `${owner}/${name}/{${paths.join(',')}}`)

      const { repository } = await GRAPHQL(
        `query ($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            ${paths.map((p) => `
              ${graphqlKey(p)}: object(expression: "HEAD:${p}") {
                ... on Tree {
                  entries {
                    name
                    type
                  }
                }
              }
            `).join('\n')}
          }
        }`,
        { owner, name }
      )

      return Object.values(repository).flatMap((v, index) =>
        v.entries
          .filter((d) => d.type === 'tree')
          .map((d) => path.join(paths[index], d.name))
      )
    },
    /**
     * @returns {Promise<(Record<string, any> | null)[]>}
     */
    pkg: async (owner, name, pathsOrPath = '') => {
      const isArray = Array.isArray(pathsOrPath)
      const paths = isArray ? pathsOrPath : [pathsOrPath]

      log.verbose(`api:repo:pkg`, `${owner}/${name}/{${paths.join(',')}}`)

      const { repository } = await GRAPHQL(
        `query ($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            ${paths.map((p) => `
              ${graphqlKey(p)}: object(expression: "HEAD:${path.join(p, 'package.json')}") {
                ... on Blob {
                  text
                }
              }
            `).join('\n')}
          }
        }`,
        { owner, name }
      )

      const pkgs = Object.values(repository).map((v) => v ? JSON.parse(v.text) : null)
      return isArray ? pkgs : pkgs[0]
    },
    /**
     * @returns {Promise<({ repo: Record<string, any>, pkg: Record<string, any> })[]>}
     */
    workspaces: async (owner, name, pkg) => {
      log.verbose(`api:repo:workspaces`, `${owner}/${name}`)

      if (!Array.isArray(pkg?.workspaces)) {
        return []
      }

      const [wsDirs, wsGlobs] = pkg.workspaces.reduce((acc, w) => {
        acc[glob.hasMagic(w) ? 1 : 0].push(w)
        return acc
      }, [[], []])

      const validWsGlobs = wsGlobs.map(wsGlob => {
        const globDir = wsGlob.slice(0, -2)
        if (wsGlob.endsWith('/*') && !glob.hasMagic(globDir)) {
          return globDir
        }

        // Recursion is possible with github tree APIs but not worth it
        // since we probably don't use more complicated ws globs and we want to be careful
        // not to hit secondary rate limits
        throw new Error('Workspaces globbed more than one level deep are not supported')
      })

      if (validWsGlobs.length) {
        wsDirs.push(...await REPO.subTrees(owner, name, validWsGlobs))
      }

      log.verbose(
        'api:repo:workspaces',
        `Looking for workspaces in ${owner}/${name} ${wsDirs.length} dirs`
      )

      return REPO.pkg(owner, name, wsDirs).then((ws) => ws.map((wsPkg, i) => ({
        repo: { isWorkspace: true, path: wsDirs[i] },
        pkg: wsPkg,
      })))
    },
    commit: cacheMethod(async (owner, name, p) => {
      log.verbose(`api:repo:commit`, `${owner}/${name}${p ? `/${p}` : ''}`)

      return REST.repos.listCommits({
        owner,
        repo: name,
        path: p,
        per_page: 1,
      }).then((r) => r.data[0])
    }),
    status: cacheMethod(async (owner, name, ref) => {
      log.verbose(`api:repo:status`, `${owner}/${name}#${ref}`)

      const checkRuns = await REST.paginate(REST.checks.listForRef, {
        owner,
        repo: name,
        ref,
        per_page: 100,
      })

      const failures = ['action_required', 'cancelled', 'failure', 'stale', 'timed_out']
      const statuses = { neutral: false, success: false, skipped: false }

      for (const checkRun of checkRuns) {
        // return early for any failures
        if (failures.includes(checkRun.conclusion)) {
          return { url: checkRun.html_url, conclusion: 'failure' }
        }
        statuses[checkRun.conclusion] = true
      }

      // Skipped or neutral and no successes is neutral
      if ((statuses.neutral || statuses.skipped) && !statuses.success) {
        return { conclusion: 'neutral' }
      }

      // otherwise allow some neutral/skipped as long as there
      // are other successful runs
      return { conclusion: 'success' }
    }),
  }

  const REPOS = {
    /**
     * @returns {Promise<({
     *  repo: Record<string, any>,
     *  pkg: Record<string, any> | null
     * })[]>}
     */
    search: async (searchQuery, { pageInfo = {}, nodes = [] } = {}) => {
      log.verbose('api:repos:search', searchQuery)

      const { search: res } = await GRAPHQL(
        `query ($searchQuery: String!, $first: Int!, $after: String) {
          search(query: $searchQuery, first: $first, type: REPOSITORY, after: $after) {
            pageInfo { endCursor hasNextPage }
            nodes {
              ... on Repository {
                name
                description
                owner { login }
                url
                isArchived
                isFork
                repositoryTopics(first: 100) {
                  nodes {
                    ... on RepositoryTopic {
                      topic {
                        name
                      }
                    }
                  }
                }
                pkg: object(expression: "HEAD:package.json") {
                  ... on Blob {
                    text
                  }
                }
              }
            }
          }
        }`,
        { searchQuery, first: 100, after: pageInfo.endCursor }
      )

      nodes.push(...res.nodes)

      if (res.pageInfo.hasNextPage) {
        log.verbose('api:repos:search', `${searchQuery} cursor:${res.pageInfo.endCursor}`)
        return REPOS.search(searchQuery, { pageInfo: res.pageInfo, nodes })
      }

      log.verbose('api:repos:search', `Fetched ${res.nodes.length} nodes`)

      return res.nodes.map(({ pkg, ...repo }) => ({
        repo: {
          ...repo,
          owner: repo.owner.login,
          repositoryTopics: repo.repositoryTopics.nodes.map((t) => t.topic.name),
        },
        pkg: pkg ? JSON.parse(pkg.text) : null,
      }))
    },
    /**
     * @returns {Promise<({
     *  repo: Record<string, any>,
     *  pkg: Record<string, any> | null,
     *  manifest: Record<string, any> | null,
     * })[]>}
     */
    searchWithWorkspaces: async (searchQuery) => {
      log.verbose('api:repos:searchWithWorkspaces', searchQuery)

      const allRepos = await REPOS.search(searchQuery)

      const allWorkspaces = await Promise.all(allRepos.map((r) =>
        REPO.workspaces(r.repo.owner, r.repo.name, r.pkg).then((wss) =>
          wss.map((ws) => merge({}, r, ws))
        )))

      return [...allRepos, ...allWorkspaces.flat()]
    },
  }

  const ISSUES = {
    getAllOpen: (owner, name) => {
      log.verbose('api:issues:getAll', `${owner}/${name}`)

      return REST.paginate(REST.search.issuesAndPullRequests, {
        q: `repo:${owner}/${name}+is:open`,
        per_page: 100,
      })
    },
  }

  const PROJECTS = {
    /**
     * @returns {Promise<({
     *  repo: Record<string, any>,
     *  pkg: Record<string, any> | null,
     *  manifest: Record<string, any> | null,
     * })[]>}
     */
    searchWithManifests: async (searchQuery) => {
      log.verbose('api:projects:searchWithManifests', searchQuery)

      const allRepos = await REPOS.searchWithWorkspaces(searchQuery)

      return Promise.all(allRepos.map(async (repo) => {
        const pkgName = !repo.pkg?.private && repo.pkg?.name
        return {
          ...repo,
          manifest: pkgName ? await PACKAGE.manifest(pkgName) : null,
        }
      }))
    },
  }

  return {
    rest: REST,
    graphql: GRAPHQL,
    repo: REPO,
    repos: REPOS,
    projects: PROJECTS,
    issues: ISSUES,
    package: PACKAGE,
  }
}
