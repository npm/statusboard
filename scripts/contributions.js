(async function () {
  require('dotenv').config()
  const Octokit = require("@octokit/rest")
  const { teams } = require('../data/info')
  const involves = teams.oss.join('+involves:')
  const datime = '2019-10-25'
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  octokit.search.issuesAndPullRequests({ q: `org:"npm"+created:>=${datime}+involves:${involves}` }).then(response => {
    console.log('# of issues/prs:', response.data['total_count'])
  })
})()