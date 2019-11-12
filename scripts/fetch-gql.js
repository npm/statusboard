(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const path = require('path')
  const { sleep } = require('sleepover')
  const query = fs.readFileSync(path.resolve(__dirname, './query.gql'), 'utf8')
  const { graphql } = require('@octokit/graphql')
  let repositories = []
  let opts = { headers: { authorization: `token ${process.env.AUTH_TOKEN}` }}
  function write (data) {
    console.log(data.length)
    // fs.writeFileSync('./dump.json', JSON.stringify(data), 'utf8')
  }
  async function run (query, after, cb) {
    if (after) {
      opts.after = after
    }
    try {
      const response = await graphql(query, opts)
      const data = response.organization.repositories
      repositories = repositories.concat(data.nodes)
      if (data.pageInfo.hasNextPage) {
        sleep(150)
        console.log('cursor:', data.pageInfo.endCursor)
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