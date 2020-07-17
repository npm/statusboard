(async function () {
  require('dotenv').config()
  const { sleep } = require('sleepover')
  const { teams } = require('../data/info')
  const employees = teams.employees
  const Octokit = require('@octokit/rest')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  octokit.search.issuesAndPullRequests({ q: `org:"npm"+merged:>=2019-10-01+is:pr+is:merged+is:public` }).then(response => {
    console.log('# of issues/prs merged', response.data['total_count'])
  })
  let contributors = []
  function run (page, cb) {
    page = page || 1
    octokit.search.issuesAndPullRequests({
      q: `org:"npm"+created:>=2019-10-01+is:pr+is:merged+is:public`,
      per_page: 100,
      page: page
    }).then((response) => {
      let data = response.data.items
      if (!data || !data.length) {
        cb(contributors)
      } else {
        page++
        contributors = contributors.concat(data.map(i => i.user.login))
        sleep(1200)
        run(page, cb)
      }
    })
  }
  run(null, (contributors) => {
    let obj = {}
    contributors = contributors.filter(i => employees.indexOf(i) < 0)
    console.log(contributors)
    contributors.forEach((c) => {
      obj[c] ? obj[c]++ : obj[c] = 1
    })
    Object.keys(obj).forEach(i => obj[i] > 5 && console.log(i, obj[i]))
    console.log('# of uniques:', [...new Set(contributors)].length)
  })
})()
