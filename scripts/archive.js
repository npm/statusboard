(async function () {
  require('dotenv').config()
  let repos = require('../data/archive')
  const { Octokit } = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  repos = repos.map(r => r.replace('https://github.com/npm/',''))
  for (let i = 0; i < repos.length; i++) {
    octokit.repos.update({ owner: "npm", repo: repos[i], archived: true }).then(response => {
      console.log('Archive:', response.data.name, response.data.archived)
    })
  }
})()