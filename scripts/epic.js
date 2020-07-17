(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { sleep } = require('sleepover')
  // const repos = require('../data/latest')
  // const ZenHub = require('zenhub-api')
  // const zenhub = new ZenHub(process.env.ZENHUB_AUTH_TOKEN)
  const { Octokit } = require('@octokit/rest')
  const Handlebars = require('handlebars')
  const source = fs.readFileSync(path.resolve(__dirname, 'epic.hbs'), 'utf8')
  const template = Handlebars.compile(source)
  // const fetch = require('node-fetch')
  const npm = new Octokit({ auth: process.env.AUTH_TOKEN })
  const github = new Octokit({ auth: process.env.GITHUB_AUTH_TOKEN })
  const queryNPM = `org:npm is:issue label:epic -label:backlog is:open is:public`
  const queryGitHub = `repo:github/npm is:issue label:epic is:open label:"CLI-Team"`
  // const oss = [ 139910229,193812680,193818300,206620712,219775300,195874389,1357199,9556133,15821540,19761728,20658455,25002984,87129681,92022198,92569773,98075774,102792426,106227009,122357526,131072921,193812470,193813560,193816752,210390077,146668808,125480737,156104684,145055756,128109144,27612014,28640038,200085633,193817839,145919620,146349815,145500230,246167265,246110676,235679249,246439333 ]
  // let epics = []
  // for(let n = 0; oss.length > n; n++) {
  //   const data = await zenhub.getEpics({ repo_id: oss[n] })
  //   console.log(`${n}. finished fetch for epics in repo...`)
  //   epics = epics.concat(data['epic_issues'])
  //   sleep(500)
  // }
  // fs.writeFileSync(path.resolve(__dirname, '../data/tickets.json'), JSON.stringify(epics), 'utf8')
  npm.search.issuesAndPullRequests({ q: queryNPM }).then(response => {
    let issues = response.data.items.filter(i => i.url)
    github.search.issuesAndPullRequests({ q: queryGitHub }).then(response => {
      let existing = response.data.items.map(i => i.title)
      let diff = issues.filter(i => !existing[i.title])
      for (let n = 0; diff.length > n; n++) {
        let { title, labels } = diff[n]
        labels = labels.map(l => l.name).concat(['CLI-Team', 'Feature'])
        const body = template({ title, url: diff[n].html_url })
        github.issues.create({
          owner: 'github',
          repo: 'npm-cli',
          title,
          body,
          labels: labels
        }).catch(e => console.error(e))
        sleep(500)
      }
    }).catch(e => console.error(e))
  }).catch(e => console.error(e))
})()
