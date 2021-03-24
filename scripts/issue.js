(async function () {
  require('dotenv').config()
  const { Octokit } = require('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const all =  `is:issue org:npm state:open is:public archived:false`
  const limit = `is:issue repo:npm/statusboard is:open`
  octokit.search.issuesAndPullRequests({ q: limit }).then(response => {
    console.log(response.data.items[0])
  })
})()