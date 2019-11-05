(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  let info = {
    teams: {
      oss: [
        "isaacs",
        "darcyclarke",
        "claudihz",
        "ruyadorno",
        "mikemimik"
      ],
      employees: []
    }
  }
  const Octokit = require("@octokit/rest")
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  octokit.teams.listMembers({ team_id: '589031' }).then(response => {
    info.teams.employees = response.data.map(u => u.login)
    fs.writeFileSync(path.resolve(__dirname, '../data/info.json'), JSON.stringify(info), 'utf8')
  })
})()