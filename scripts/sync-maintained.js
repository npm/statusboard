require('dotenv').config()

// Repos that live outside the npm org
const manual = require('../public/data/manual.json')
const pacote = require('pacote')
const fs = require('fs')

const org = 'npm'
const topic = 'npm-cli'

const {
  getMaintainedRepos,
} = require('../api')

const exec = async () => {
  const maintained = []
  console.log(`Getting repos in ${org} org with topic ${topic}`)
  const repos = await getMaintainedRepos(org, topic)
  console.group()
  console.log(`Found ${repos.length} repos`)
  console.groupEnd()
  if (repos.length === 0) {
    return // error state, logged in api already
  }
  console.log('Fetching manifests:')
  console.group()
  for (const repo of repos) {
    console.log(repo.name)
    const entry = {
      name: repo.name,
      description: repo.description,
      repository: repo.url
    }
    try {
      const manifest = await pacote.manifest(`${org}/${repo.name}`)
      if (!manifest.private) {
        console.group()
        console.log(`package name ${manifest.name}`)
        console.groupEnd()
        entry.package = manifest.name
      }
    } catch (err) {
      console.error(`could not fetch manifest for ${org}/${repo.name}`)
      console.stack(err)
    }
    maintained.push(entry)
  }
  console.groupEnd()
  console.log(`Adding ${manual.length} manual entries`)
  const data = [...maintained, ...manual]
  console.log(`Writing ${data.length} entries to maintained.json`)
  fs.writeFileSync('./public/data/maintained.json', JSON.stringify(data, null, ' '))
}

exec()
