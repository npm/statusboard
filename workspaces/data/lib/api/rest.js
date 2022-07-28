const { Octokit } = require('@octokit/rest')
const { retry } = require('@octokit/plugin-retry')
const { throttling } = require('@octokit/plugin-throttling')
const log = require('proc-log')
const GraphqlApi = require('./graphql.js')
const cacheMethod = require('./cache.js')

module.exports = ({ auth }) => {
  const { getPkg } = GraphqlApi({ auth })

  const REST = new (Octokit.plugin(retry, throttling))({
    auth,
    log,
    retry: {
      doNotRetry: [404, 422],
    },
    request: {
      retries: 1,
      retryAfter: 5,
    },
    throttle: {
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        )

        if (options.request.retryCount === 0) {
          // only retries once
          octokit.log.info(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
      onSecondaryRateLimit: (__, options, octokit) => {
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`
        )
      },
    },
  })

  const REPO = {
    get: cacheMethod((owner, repo) => {
      log.verbose(`rest:repo:get`, `${owner}/${repo}`)
      return REST.repos.get({ owner, repo }).then(d => d.data)
    }),
    commit: cacheMethod(async (owner, name, p) => {
      log.verbose(`rest:repo:commit`, `${owner}/${name}${p ? `/${p}` : ''}`)

      return REST.repos.listCommits({
        owner,
        repo: name,
        path: p,
        per_page: 1,
      }).then((r) => r.data[0])
    }),
    status: cacheMethod(async (owner, name, ref) => {
      log.verbose(`rest:repo:status`, `${owner}/${name}#${ref}`)

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
    pkg: getPkg,
  }

  const ISSUES = {
    getAllOpen: cacheMethod((owner, name) => {
      log.verbose('rest:issues:getAll', `${owner}/${name}`)

      return REST.paginate(REST.search.issuesAndPullRequests, {
        q: `repo:${owner}/${name}+is:open`,
        per_page: 100,
      })
    }),
  }

  return {
    repo: REPO,
    issues: ISSUES,
  }
}
