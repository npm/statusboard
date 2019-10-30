(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const Octokit = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  let repositories = []
  function write (data) {
    fs.writeFileSync('./dump.json', JSON.stringify(data), 'utf8')
  }
  function run (page, cb) {
    page = page || 1
    octokit.repos
      .listForOrg({
        org: "npm",
        type: "public",
        per_page: 100,
        page: page
      }).then(({ data }) => {
        if (!data || !data.length) {
          cb(repositories)
        } else {
          page++
          repositories = repositories.concat(data)
          run(page, cb)
        }
      })
  }
  run(null, write)

})()