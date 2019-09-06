(async function () {
  require('dotenv').config()
  const fs = require('fs')
  const query = fs.readFileSync('./query.gql', 'utf8')
  const { graphql } = require('@octokit/graphql')
  const { organization } = await graphql(query, { headers: { authorization: `token ${process.env.AUTH_TOKEN}` }})
  fs.writeFileSync('./dump.json', JSON.stringify(organization), 'utf8')
})()