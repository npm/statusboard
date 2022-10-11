const path = require('path')
const { graphql: Graphql } = require('@octokit/graphql')
const glob = require('glob')
const { merge, get } = require('lodash')
const log = require('proc-log')
const packageApi = require('./package.js')

const graphqlKey = (k) => `_${k.replace(/[^_0-9A-Za-z]/g, '')}`

module.exports = ({ auth }) => {
  const GRAPHQL = Graphql.defaults({
    headers: {
      authorization: `token ${auth}`,
    },
  })

  const paginateQuery = (query, { query: queryName, ...variables }) => {
    const paginatedQuery = async ({ pageInfo = {}, nodes = [] } = {}) => {
      const res = await GRAPHQL(query, {
        ...variables,
        first: 100,
        after: pageInfo.endCursor,
      }).then(r => get(r, queryName))

      nodes.push(...res.nodes)

      if (res.pageInfo.hasNextPage) {
        log.verbose('graphql:paginate',
          `nodes: ${res.nodes.length}, cursor:${res.pageInfo.endCursor}`)
        return paginatedQuery({ pageInfo: res.pageInfo, nodes })
      }

      log.verbose('graphql:paginate', `total: ${nodes.length}`)

      return nodes
    }

    return paginatedQuery()
  }

  const getDiscussions = async (owner, name, query = '') => {
    log.verbose(`graphql:discussions`, `${owner}/${name} ${query}`)

    return paginateQuery(
      `query ($owner: String!, $name: String!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $name) {
          discussions (first: $first, after: $after) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              id
              ${query}
            }
          }
        }
      }`,
      { owner, name, query: 'repository.discussions' }
    )
  }

  /**
    * @returns {Promise<string[]>}
    */
  const getSubTrees = async (owner, name, paths) => {
    log.verbose(`graphql:subTrees`, `${owner}/${name}/{${paths.join(',')}}`)

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
          `)}
        }
      }`,
      { owner, name }
    )

    return Object.values(repository).flatMap((v, index) =>
      v.entries
        .filter((d) => d.type === 'tree')
        .map((d) => path.join(paths[index], d.name))
    )
  }

  /**
    * @returns {Promise<(Record<string, any> | null)[]>}
    */
  const getPkg = async (owner, name, pathsOrPath = '') => {
    const isArray = Array.isArray(pathsOrPath)
    const paths = isArray ? pathsOrPath : [pathsOrPath]

    log.verbose(`graphql:pkg`, `${owner}/${name}/{${paths.join(',')}}`)

    const { repository } = await GRAPHQL(
      `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          ${paths.map((p) => `
            ${graphqlKey(p)}: object(expression: "HEAD:${path.join(p, 'package.json')}") {
              ... on Blob {
                text
              }
            }
          `)}
        }
      }`,
      { owner, name }
    )

    const pkgs = Object.values(repository).map((v) => v ? JSON.parse(v.text) : null)
    return isArray ? pkgs : pkgs[0]
  }

  /**
    * @returns {Promise<({ repo: Record<string, any>, pkg: Record<string, any> })[]>}
    */
  const getWorkspaces = async (owner, name, workspaces) => {
    log.verbose(`graphql:workspaces`, `${owner}/${name}`)

    if (!Array.isArray(workspaces)) {
      return []
    }

    const [wsDirs, wsGlobs] = workspaces.reduce((acc, w) => {
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
      wsDirs.push(...await getSubTrees(owner, name, validWsGlobs))
    }

    log.verbose(
      'graphql:workspaces',
        `Looking for workspaces in ${owner}/${name} ${wsDirs.length} dirs`
    )

    return getPkg(owner, name, wsDirs).then((ws) => ws.map((wsPkg, i) => ({
      repo: { isWorkspace: true, path: wsDirs[i] },
      pkg: wsPkg,
    })))
  }

  /**
    * @returns {Promise<({
    *  repo: Record<string, any>,
    *  pkg: Record<string, any> | null
    * })[]>}
    */
  const searchRepos = async (searchQuery) => {
    log.verbose('graphql:search', searchQuery)

    const nodes = await paginateQuery(
      `query ($searchQuery: String!, $first: Int!, $after: String) {
        search(query: $searchQuery, type: REPOSITORY, first: $first, after: $after) {
          pageInfo {
            endCursor
            hasNextPage
          }
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
      { searchQuery, query: 'search' }
    )

    return nodes.map(({ pkg, ...repo }) => ({
      repo: {
        ...repo,
        owner: repo.owner.login,
        repositoryTopics: repo.repositoryTopics.nodes.map((t) => t.topic.name),
      },
      pkg: pkg ? JSON.parse(pkg.text) : null,
    }))
  }

  /**
    * @returns {Promise<({
    *  repo: Record<string, any>,
    *  pkg: Record<string, any> | null,
    *  manifest: Record<string, any> | null,
    * })[]>}
    */
  const searchReposWithWorkspaces = async (searchQuery) => {
    log.verbose('graphql:searchWithWorkspaces', searchQuery)

    const allRepos = await searchRepos(searchQuery)

    const allWorkspaces = await Promise.all(allRepos.map((r) =>
      getWorkspaces(r.repo.owner, r.repo.name, r.pkg?.workspaces).then((wss) =>
        wss.map((ws) => merge({}, { repo: r.repo }, ws))
      )))

    return [...allRepos, ...allWorkspaces.flat()]
  }

  /**
    * @returns {Promise<({
    *  repo: Record<string, any>,
    *  pkg: Record<string, any> | null,
    *  manifest: Record<string, any> | null,
    * })[]>}
    */
  const searchReposWithManifests = async (searchQuery) => {
    log.verbose('graphql:searchWithManifests', searchQuery)

    const allRepos = await searchReposWithWorkspaces(searchQuery)

    return Promise.all(allRepos.map(async (repo) => {
      const pkgName = !repo.pkg?.private && repo.pkg?.name
      return {
        ...repo,
        manifest: pkgName ? await packageApi.manifest(pkgName) : null,
      }
    }))
  }

  return {
    searchReposWithManifests,
    getPkg,
    getDiscussions,
  }
}
