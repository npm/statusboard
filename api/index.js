require('dotenv').config()
const fetch = require('node-fetch')
const pacote = require('pacote')
const Rest = require('@octokit/rest')
const { throttling } = require('@octokit/plugin-throttling')
const Octokit = Rest.Octokit.plugin(throttling)

const FETCH_OPTIONS = {
  redirect: 'follow',
  follow: 5,
  retries: 3,
  retryDelay: function (attempt, error, response) {
    return Math.pow(2, attempt) * 500
  },
  retryOn: function (attempt, error, response) {
    // retry when we have networking errors & response code an error but not 404
    if (error !== null || (response.status !== 404 && response.status >= 400)) {
      return true
    }
  }
}

const octokit = new Octokit({
  auth: process.env.AUTH_TOKEN,
  retry: {
    doNotRetry: [404, 422]
  },
  //   log: console,
  request: {
    retries: 1,
    retryAfter: 5
  },
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

      if (options.request.retryCount === 0) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
    }
  }
})

const api = {
  createRepoLabel: async (owner, repo, label) => {
    return octokit.issues.createLabel({
      owner,
      repo,
      name: label.name,
      description: label.description || '',
      color: label.color || ''
    })
  },
  getRepoLabels: async (owner, repo) => {
    return octokit.paginate(octokit.issues.listLabelsForRepo, {
      owner,
      repo,
      per_page: 100
    })
  },
  getPullRequests: async (owner, repo) => {
    return octokit.paginate(octokit.pulls.list, {
      owner,
      repo,
      per_page: 100,
      state: 'open'
    })
  },
  getMaintainedRepos: async (owner, topic) => {
    return octokit.paginate('GET /search/repositories', {
      q: `org:${owner} topic:${topic}`,
      sort: 'name',
      order: 'asc',
    })
  },
  getRepo: async (owner, repo) => {
    return octokit.repos.get({
      owner,
      repo
    })
  },
  getRepoIssues: async (owner, repo, labels = '') => {
    return octokit.paginate('GET /repos/{owner}/{repo}/issues', {
      owner,
      repo,
      state: 'open',
      labels,
      per_page: 100
    })
  },
  getNoLabelIssues: async (owner, repo) => {
    const repoName = `${owner}/${repo}`
    const results = []
    for await (const response of octokit.paginate.iterator(octokit.search.issuesAndPullRequests, {
      q: `repo:${repoName}+is:issue+is:open+no:label`,
      per_page: 100
    })) {
      response.data.forEach((d) => results.push(d))
    }
    return results
  },
  getCheckRuns: async (owner, repo, ref) => {
    return octokit.paginate('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
      owner,
      repo,
      ref
    })
  },
  getCoveralls: async (owner, repo) => {
    const response = await fetch(`https://coveralls.io/github/${owner}/${repo}.json`, FETCH_OPTIONS)

    if (!response.ok) {
      console.warn('No coverage data:', `https://coveralls.io/github/${owner}/${repo}.json`)
      return
    }

    return response.json()
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
  }
}

module.exports = api
