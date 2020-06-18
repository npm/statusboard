(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { sleep } = require('sleepover')
  const fetch = require('node-fetch')
  const mkdirp = require('mkdirp')
  const moment = require('moment')
  const { Octokit } = require('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const month = String('00' + (now.getUTCMonth()+1)).slice(-2)
  const dest = `../data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const latest = `../data/latest.json`
  const dir = dest.split('/').slice(0, -1).join('/')
  let repositories = []
  function writeFile (data) {
    mkdirp(path.resolve(__dirname, dir), function (err) {
      if (err) console.error(err)
      fs.writeFileSync(path.resolve(__dirname, dest), JSON.stringify(data), 'utf8')
      fs.writeFileSync(path.resolve(__dirname, latest), JSON.stringify(data), 'utf8')
    })
  }
  function run (page, cb) {
    page = page || 1
    octokit.repos
      .listForOrg({
        org: 'npm',
        type: 'public',
        per_page: 100,
        page: page
      }).then(({ data }) => {
        if (!data || !data.length) {
          repositories = repositories.filter(r => !r.archived)
          Promise.all(repositories.map(async r => {
            try {

              let response
              let pkg
              let stats
              let data

              let prs = await octokit.pulls.list({
                owner: 'npm',
                repo: r.name,
                per_page: 100
              })
              r.prs_count = prs.data.length || 0

              let issues = await octokit.issues.listForRepo({
                owner: 'npm',
                repo: r.name,
                per_page: 100
              })
              r.issues_count = (issues.data.length || 0) - r.prs_count

              r.pushed_at_diff = moment(r.pushed_at).fromNow()
              console.log(r.pushed_at_diff)

              let status = await octokit.repos.listStatusesForRef({
                owner: 'npm',
                repo: r.name,
                ref: r.default_branch
              })
              r.build_status = status && status.data && status.data[0] ? status.data[0].state : ''

              try {
                response = await fetch(`https://coveralls.io/github/npm/${r.name}.json`)
                stats = await response.json()
              } catch (e) {
                console.error(e)
              }
              r.coverage = stats ? Math.round(stats.covered_percent) : ''
              r.coverageLevel = r.coverage ? (r.coverage === 100) ? 'high' : (r.coverage > 80) ? 'medium' : 'low' : ''

              try {
                response = await fetch(`https://raw.githack.com/npm/${r.name}/${r.default_branch}/package.json`)
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

              return r

            } catch (e) {
              console.error(e)
            }

            return r

          })).then(cb).catch(e => console.error(e))
        } else {
          page++
          repositories = repositories.concat(data)
          sleep(1500)
          run(page, cb)
        }
      })
  }
  run(null, writeFile)
})()