const fetch = require('node-fetch')
const pacote = require('pacote')
const Rest = require('@octokit/rest')
const { throttling } = require('@octokit/plugin-throttling')
const { retry } = require('@octokit/plugin-retry')

const Octokit = Rest.Octokit.plugin(throttling, retry)

const octokit = new Octokit({
  auth: process.env.AUTH_TOKEN,
  retry: {
    doNotRetry: [404, 422],
  },
  request: {
    retries: 1,
    retryAfter: 5,
  },
  throttle: {
    onRateLimit: (retryAfter, options, kit) => {
      kit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

      if (options.request.retryCount === 0) {
        // only retries once
        kit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options, kit) => {
      // does not retry, only logs a warning
      kit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
    },
  },
})

const api = {
  getPullRequests: async (owner, repo) => {
    return octokit.paginate(octokit.pulls.list, {
      owner,
      repo,
      per_page: 100,
      state: 'open',
    })
  },
  getRepos: async (owner, topic) => {
    return octokit.paginate('GET /search/repositories', {
      q: `org:${owner} topic:${topic}`,
      sort: 'name',
      order: 'asc',
    })
  },
  getRepo: async (owner, repo) => {
    return octokit.repos.get({
      owner,
      repo,
    })
  },
  getRepoIssues: async (owner, repo, labels = '') => {
    return octokit.paginate('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: 'open',
      labels,
      per_page: 100,
    })
  },
  getNoLabelIssues: async (owner, repo) => {
    const repoName = `${owner}/${repo}`
    const results = []
    for await (const response of octokit.paginate.iterator(octokit.search.issuesAndPullRequests, {
      q: `repo:${repoName}+is:issue+is:open+no:label`,
      per_page: 100,
    })) {
      response.data.forEach((d) => results.push(d))
    }
    return results
  },
  getCheckRuns: async (owner, repo, ref) => {
    return octokit.paginate('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      owner,
      repo,
      ref,
    })
  },
  getManifest: async (pkg) => {
    try {
      const manifest = await pacote.manifest(pkg, { fullMetadata: true })
      return manifest
    } catch (_) {
      return {}
    }
  },
  getPackument: async (pkg) => {
    try {
      const packument = await pacote.packument(pkg)
      return packument
    } catch (_) {
      return {}
    }
  },
  getDownloads: async (pkg = '') => {
    const response = await fetch(`https://api.npmjs.org/downloads/point/last-month/${pkg}`)

    if (!response.ok) {
      console.warn('No download data:', `https://api.npmjs.org/downloads/point/last-month/${pkg}`)
      return
    }

    return response.json()
  },
}

module.exports = api
