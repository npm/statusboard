require('dotenv').config()
const fetch = require('node-fetch')
const Rest = require('@octokit/rest')
const { throttling } = require('@octokit/plugin-throttling')
const { retry } = require('@octokit/plugin-retry')
const Octokit = Rest.Octokit.plugin(throttling, retry)

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
    doNotRetry: [404]
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
    onAbuseLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`
      )
    }
  }
})

async function getPullRequests (owner, repo) {
  try {
    return octokit.pulls.list({ owner, repo, per_page: 100 })
  } catch (error) {
    console.log(error)
    return []
  }
}

async function getRepo (owner, repo) {
  try {
    return octokit.repos.get({
      owner,
      repo
    })
  } catch (error) {
    console.log(error)
    return []
  }
}

async function getRepoIssues (owner, repo, labels = '') {
  try {
    return octokit.issues
      .listForRepo({ owner, repo, state: 'open', labels })
      .then((issues) => issues.data)
  } catch (error) {
    console.log(error)
    return {}
  }
}

async function getDeployments (owner, repo, ref) {
  try {
    return octokit.request('GET /repos/:owner/:repo/commits/:ref/status', {
      owner,
      repo,
      ref
    })
  } catch (error) {
    console.log(error)
    return {}
  }
}

async function getCoveralls (owner, repo) {
  const response = await fetch(
    `https://coveralls.io/github/${owner}/${repo}.json`,
    FETCH_OPTIONS
  )

  if (!response.ok) {
    console.warn(
      'No coverage data:',
      `https://coveralls.io/github/${owner}/${repo}.json`
    )
    return
  }

  return response.json()
}

async function getPkgData (pkg) {
  const response = await fetch(
    `https://unpkg.com/${pkg}/package.json`,
    FETCH_OPTIONS
  )

  if (!response.ok) {
    console.warn('No package data:', `https://unpkg.com/${pkg}/package.json`)
    return
  }

  return response.json()
}

async function getDownloads (pkg = '') {
  const response = await fetch(
      `https://api.npmjs.org/downloads/point/last-month/${pkg}`
  )

  if (!response.ok) {
    console.warn(
      'No download data:',
        `https://api.npmjs.org/downloads/point/last-month/${pkg}`
    )
    return
  }

  return response.json()
}

module.exports = {
  getRepoIssues,
  getDeployments,
  getPkgData,
  getCoveralls,
  getPullRequests,
  getRepo,
  getDownloads
}
