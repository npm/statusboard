const { Octokit } = require('@octokit/rest')
const { retry } = require('@octokit/plugin-retry')
const { throttling } = require('@octokit/plugin-throttling')
const log = require('proc-log')
const { groupBy, orderBy } = require('lodash')
const config = require('../config')

module.exports = ({ auth }) => {
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

  const getRepo = (owner, repo) => {
    log.verbose(`rest:repo:get`, `${owner}/${repo}`)
    return REST.repos.get({ owner, repo }).then(d => d.data)
  }

  const getCommit = async (owner, name, p) => {
    log.verbose(`rest:repo:commit`, `${owner}/${name}${p ? `/${p}` : ''}`)

    return REST.repos.listCommits({
      owner,
      repo: name,
      path: p,
      per_page: 1,
    }).then((r) => r.data[0])
  }

  const getStatus = async (owner, name, ref) => {
    log.verbose(`rest:repo:status`, `${owner}/${name}#${ref}`)

    const allCheckRuns = await REST.paginate(REST.checks.listForRef, {
      owner,
      repo: name,
      ref,
      // since we are paginating through all checks for the ref, you might
      // think we should make per_page=100 since that is the max, but that
      // makes it very flaky and prone to 500 for npm/cli. its safer (but slower)
      // to make more but smaller requests
      per_page: 30,
    })

    // For some of our repos that don't get very many commits, we still run
    // a lot of scheduled actions against them. This reduces a status to the
    // latest check for each run name (eg, 'test (12.13.0, windows-latest, cmd)')
    const runsByName = groupBy(allCheckRuns, 'name')

    const checkRuns = Object.entries(runsByName).reduce((acc, [checkName, runs]) => {
      if (config.checkRunFilter(checkName, runs)) {
        const [latestRun] = orderBy(runs, 'completed_at', 'desc')
        acc.push(latestRun)
      }
      return acc
    }, [])

    log.verbose(`rest:repo:status:names`, checkRuns.map(c => c.name).join('\n'))

    const failures = ['action_required', 'cancelled', 'failure', 'stale', 'timed_out', null]
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
  }

  const getAllIssuesAndPullRequests = (owner, name, query = '') => {
    log.verbose('rest:issues:getAll', `${owner}/${name}`)

    return REST.paginate(REST.search.issuesAndPullRequests, {
      q: `repo:${owner}/${name}+${query}`,
    })
  }

  return {
    getRepo,
    getCommit,
    getStatus,
    getAllIssuesAndPullRequests,
  }
}
