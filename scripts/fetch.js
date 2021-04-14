(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { sleep } = require('sleepover')
  const fetch = require('node-fetch')
  const mkdirp = require('mkdirp')
  const moment = require('moment')
  const repositories = require('../../data/maintained.json')
  const { Octokit } = require('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const month = String('00' + (now.getUTCMonth() + 1)).slice(-2)
  const dest = `../data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const latest = '../data/latest.json'
  const dir = dest.split('/').slice(0, -1).join('/')
  const opts = {
    redirect: 'follow',
    follow: 5
  }
  function isJSON (response) {
    return (
      response.ok && response.headers.get('content-type') === 'application/json'
    )
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
          path.resolve(__dirname, latest),
          JSON.stringify(data),
          'utf8'
        )
      })
      .catch((err) => console.error(err))
  }
  const temp = []
  for (let i = 0; i < repositories.length; i++) {
    let r = (_ = repositories[i])
    try {
      let response
      let pkg
      let stats
      let data
      const repo = _.repository.split('/').slice(-2)
      const owner = repo[0]
      const name = repo[1]
      const prs = await octokit.pulls.list({
        owner,
        repo: name,
        per_page: 100
      })
      r = await octokit.repos.get({
        owner,
        repo: name
      })
      r = r.data
      r.owner = owner
      r.name = name
      r.package = _.package
      r.prs_count = prs.data.length || 0
      r.prs_count = r.prs_count >= 100 ? '100+' : r.prs_count
      r.issues_count = (r.open_issues_count || 0) - r.prs_count
      r.pushed_at_diff = moment(r.pushed_at).fromNow()

      console.log(
        'fetching coverage:',
        `https://coveralls.io/github/${owner}/${name}.json`
      )
      response = await fetch(
        `https://coveralls.io/github/${owner}/${name}.json`,
        opts
      )
      stats = isJSON(response) ? await response.json() : null
      r.coverage = stats ? Math.round(stats.covered_percent) : ''
      r.coverageLevel = r.coverage
        ? r.coverage === 100
          ? 'high'
          : r.coverage > 80
            ? 'medium'
            : 'low'
        : ''

      console.log(
        'fetching pkg:',
        `https://unpkg.com/${r.package}/package.json`
      )
      response = await fetch(
        `https://unpkg.com/${r.package}/package.json`,
        opts
      )
      pkg = isJSON(response) ? await response.json() : null

      console.log(
        'fetching downloads:',
        `https://api.npmjs.org/downloads/point/last-month/${r.package}`
      )
      response = await fetch(
        `https://api.npmjs.org/downloads/point/last-month/${r.package}`,
        opts
      )
      data = isJSON(response) ? await response.json() : null

      r.node = pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null
      r.license = r.license || {}
      r.license.key =
        r.license && r.license.spdx_id != 'NOASSERTION'
          ? r.license.spdx_id
          : null
      r.version = pkg ? pkg.version : null
      r.downloads = data && data.downloads ? data.downloads : 0
    } catch (e) {
      console.error(e)
    }
    temp.push(r)
    sleep(600)
  }
  writeFile(temp)
})()
