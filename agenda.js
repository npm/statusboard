(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const repos = require('./repositories.json')
  const Octokit = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  octokit.search.issuesAndPullRequests({ q: `label:"Agenda"+org:"npm"` }).then(response => {
    response.data.items.forEach(i => {
      console.log(`1. **${i.pull_request ? 'PR' : 'Issue'}**: [#${i.number} ${i.title}](${i.url})`)
    })
  })
})()