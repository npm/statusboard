const t = require('tap')
const fs = require('fs')
const Api = require('../lib/api.js')
const getAllData = require('../lib/data.js')

const api = Api({ auth: process.env.AUTH_TOKEN })

// t.test('search repos', async () => {
//   const res = await api.repos.searchWithWorkspaces(`org:npm is:public`)

//   console.log(JSON.stringify(res, null, 2))

//   const repos = res
//     .filter((r, i) => {
//       try {
//         return !r.repo.repositoryTopics.includes('npm-cli') && !r.repo.isFork && !r.repo.isWorkspace
//       } catch (e) {
//         console.log(i, JSON.stringify(r))
//         throw e
//       }
//     })

//   fs.writeFileSync('./repos.json', JSON.stringify(repos, null, 2))

//   console.log(repos)
//   console.log(repos.length)

//   // const issues = await api.issues.getAllOpen('npm', 'cli')

//   // console.log(issues.length)
// })

t.test('repo data', async () => {
  const repos = require('../../www/lib/data/maintained.json')
  const workspace = repos.find((r) => r.pkg?.name === 'libnpmhook')
  const package = repos.find((r) => r.pkg?.name === '@npmcli/config')
  const noPackage = repos.find((r) => r.repo.name === 'benchmarks')
  const cli = repos.find((r) => r.pkg?.name === 'npm')

  console.log(await getAllData({ api, project: workspace }))
  console.log(await getAllData({ api, project: package }))
  console.log(await getAllData({ api, project: noPackage }))
  console.log(await getAllData({ api, project: cli }))
})

// t.test('repo data', async () => {

//   console.log(await getAllData('npm', 'cli', 'workspaces/libnpmhook'))
// })
