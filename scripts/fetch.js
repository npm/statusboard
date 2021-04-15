(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const fetch = require('node-fetch')
  const mkdirp = require('mkdirp')
  const dateFns = require('date-fns')
  const Rest = require('@octokit/rest')
  const { throttling } = require('@octokit/plugin-throttling')
  const { retry } = require('@octokit/plugin-retry')

  const fetchRetry = require('fetch-retry')(fetch)

  const Octokit = Rest.Octokit.plugin(throttling, retry)
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

  const repositories = require('../data/maintained.json')
  const latestJSON = '../data/latest.json'

  const now = new Date()
  const month = String('00' + (now.getUTCMonth() + 1)).slice(-2)
  const dest = `../data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const dir = dest.split('/').slice(0, -1).join('/')
  const opts = {
    redirect: 'follow',
    follow: 5,
    retries: 3,
    retryDelay: function (attempt, error, response) {
      return Math.pow(2, attempt) * 500
    },
    retryOn: function (attempt, error, response) {
      // retry when we have networking errors & response code an error but not 404
      if (
        error !== null ||
        (response.status !== 404 && response.status >= 400)
      ) {
        return true
      }
    }
  }

  function writeFile (data) {
    mkdirp(path.resolve(__dirname, dir))
      .then(() => {
        fs.writeFileSync(
          path.resolve(__dirname, dest),
          JSON.stringify(data),
          'utf8'
        )
        fs.writeFileSync(
          path.resolve(__dirname, latestJSON),
          JSON.stringify(data),
          'utf8'
        )
      })
      .catch((err) => console.error(err))
  }

  const repoPromises = repositories.map(async (repository) => {
    try {
      const repoString = repository.repository.split('/').slice(-2)
      const owner = repoString[0]
      const name = repoString[1]

      const prs = await octokit.pulls.list({
        owner,
        repo: name,
        per_page: 100
      })
      const prCount = prs.data.length || 0

      const { data: repoData } = await octokit.repos.get({
        owner,
        repo: name
      })

      console.log(
        'Fetching coverage:',
        `https://coveralls.io/github/${owner}/${name}.json`
      )
      const coverallsResponse = await fetchRetry(
        `https://coveralls.io/github/${owner}/${name}.json`,
        opts
      )

      let coverallsData = null
      try {
        coverallsData = await coverallsResponse.json()
      } catch (error) {
        if (error.type === 'invalid-json') {
          console.warn(
            'No coverage data:',
            `https://coveralls.io/github/${owner}/${name}.json`
          )
        } else {
          console.error(error)
        }
      }
      const coverage = coverallsData
        ? Math.round(coverallsData.covered_percent)
        : ''

      let pkg, downloads, nodeVersion
      if (repository.package) {
        console.log(
          'Fetching package data:',
          `https://unpkg.com/${repository.package}/package.json`
        )
        const pkgResponse = await fetchRetry(
          `https://unpkg.com/${repository.package}/package.json`,
          opts
        )

        try {
          pkg = await pkgResponse.json()
        } catch (error) {
          if (error.type === 'invalid-json') {
            console.warn(
              'No package data:',
              `https://unpkg.com/${repository.package}/package.json`
            )
          } else {
            console.error(error)
          }
        }
        nodeVersion =
          pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null

        console.log(
          'Fetching downloads:',
          `https://api.npmjs.org/downloads/point/last-month/${repository.package}`
        )
        const downloadResponse = await fetchRetry(
          `https://api.npmjs.org/downloads/point/last-month/${repository.package}`,
          opts
        )

        try {
          downloads = await downloadResponse.json()
        } catch (error) {
          if (error.type === 'invalid-json') {
            console.warn(
              'No download data:',
              `https://api.npmjs.org/downloads/point/last-month/${repository.package}`
            )
          } else {
            console.error(error)
          }
        }
      }

      const data = {
        ...repoData,
        owner,
        name,
        package: repository.package,
        prs_count: prCount >= 100 ? '100+' : prCount,
        issues_count: repoData.open_issues_count,
        pushed_at_diff: dateFns.formatDistanceToNow(
          new Date(repoData.pushed_at),
          { addSuffix: false, includeSeconds: false }
        ),
        coverage,
        coverageLevel: coverage
          ? coverage === 100
            ? 'high'
            : coverage > 80
              ? 'medium'
              : 'low'
          : '',
        node: nodeVersion,
        license: repoData.license
          ? {
              ...repoData.license,
              key:
                repoData.license.spdx_id !== 'NOASSERTION'
                  ? repoData.license.spdx_id
                  : null
            }
          : {},
        version: pkg ? pkg.version : null,
        downloads: downloads && downloads.downloads ? downloads.downloads : 0
      }
      return data
    } catch (error) {
      console.error(error)
    }
  })

  const fileContents = await Promise.all(repoPromises)
  writeFile(fileContents)
})()
