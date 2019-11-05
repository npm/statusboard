(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const mkdirp = require('mkdirp')
  const Octokit = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const dest = `../data/${now.getUTCFullYear()}/${now.getUTCMonth()}/${now.getUTCDate()}.json`
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
          cb(repositories.filter(r => !r.archived))
        } else {
          page++
          repositories = repositories.concat(data)
          run(page, cb)
        }
      })
  }
  run(null, writeFile)
})()