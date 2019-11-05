(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const { sleep } = require('sleepover')
  const query = fs.readFileSync('./query.gql', 'utf8')
  const { graphql } = require('@octokit/graphql')
  let repositories = []
  let opts = { headers: { authorization: `token ${process.env.AUTH_TOKEN}` }}
  function write (data) {
    console.log('writing...')
    fs.writeFileSync('./dump.json', JSON.stringify(data), 'utf8')
  }
  async function run (query, after, cb) {
    if (after) {
      opts.after = after
    }
    console.log('running....', after)
    try {
      const response = await graphql(query, opts)
      const data = response.organization.repositories
      console.log('repos found:', data.nodes.length)
      repositories = repositories.concat(data.nodes)
      if (data.pageInfo.hasNextPage) {
        sleep(1500)
        run(query, data.pageInfo.endCursor, cb)
      } else {
        cb(repositories)
      }
    } catch (error) {
      console.log("Request failed:", error.request)
      console.log(error.message)
      console.log(error.data)
      cb(repositories)
    }
  }
  await run(query, null, write)
})()