(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { sleep } = require('sleepover')
  const fetch = require('node-fetch')
  const mkdirp = require('mkdirp')
  const moment = require('moment')
  const repositories = require('../data/maintained.json')
  const { Octokit } = require('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const month = String('00' + (now.getUTCMonth()+1)).slice(-2)
  const dest = `../data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const latest = `../data/latest.json`
  const dir = dest.split('/').slice(0, -1).join('/')
  function writeFile (data) {
    console.log(data)
    mkdirp(path.resolve(__dirname, dir)).then(() => {
      fs.writeFileSync(path.resolve(__dirname, dest), JSON.stringify(data), 'utf8')
      fs.writeFileSync(path.resolve(__dirname, latest), JSON.stringify(data), 'utf8')
    }).catch(err => console.error(err))
  }
  Promise.all(repositories.map(async _ => {
    let r = _
    try {
      let response
      let pkg
      let stats
      let data
      let repo = _.repository.split('/').slice(-2)
      let owner = repo[0]
      let name = repo[1]
      let prs = await octokit.pulls.list({
        owner,
        repo: name,
        per_page: 100
      })
      r = await octokit.repos.get({
        owner,
        repo: name
      })
      r = r.data
      r.prs_count = prs.data.length || 0
      r.prs_count = r.prs_count  === 100 ? '100+' : r.prs_count
      r.issues_count = (r.open_issues_count || 0) - r.prs_count
      r.pushed_at_diff = moment(r.pushed_at).fromNow()
      try {
        response = await fetch(`https://coveralls.io/github/${owner}/${name}.json`)
        stats = await response.json()
      } catch (e) {
        console.error(e)
      }
      r.coverage = stats ? Math.round(stats.covered_percent) : ''
      r.coverageLevel = r.coverage ? (r.coverage === 100) ? 'high' : (r.coverage > 80) ? 'medium' : 'low' : ''
      try {
        response = await fetch(`https://raw.githack.com/${owner}/${name}/${r.default_branch}/package.json`)
        // response = await fetch(`https://unpkg.com/${_.name}/package.json`)
        pkg = await response.json()
        if (pkg && pkg.name) {
          response = await fetch(`https://api.npmjs.org/downloads/point/last-month/${pkg.name}`)
          data = await response.json()
        }
      } catch (e) {
        console.error(e)
      }
      r.node = pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null
      r.license.key = pkg ? pkg.license || r.license.key : null
      r.version = pkg ? pkg.version : null
      r.downloads = data && data.downloads ? data.downloads : 0
    } catch (e) {
      console.error(e)
    }

    sleep(1000)
    return r

  })).then(writeFile).catch(e => console.error(e))

})()
