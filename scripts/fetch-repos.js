const pacote = require('pacote')
const fs = require('fs')

const api = require('../lib/api.js')

const org = 'npm'
const topic = 'npm-cli'

const exec = async () => {
  const data = []

  console.log(`Getting repos in ${org} org with topic ${topic}`)
  const repos = await api.getRepos(org, topic)

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
      repository: repo.url,
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
      console.error(err)
    }
    data.push(entry)
  }
  console.groupEnd()

  console.log(`Writing ${data.length} entries to repos.json`)
  fs.writeFileSync('./public/data/repos.json', JSON.stringify(data, null, ' '))
}

exec()
