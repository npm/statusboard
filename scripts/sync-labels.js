require('dotenv').config()
const { sleep } = require('sleepover')
const { getRepoLabels, createRepoLabel } = require('../api')
const { writeFile } = require('../lib/fetch')

const syncLabels = async (repositories = []) => {
  const repoLabelMap = {}
  const uniqueLabels = {}

  const dest = '../public/data/unique-labels.json'
  const dir = dest.split('/').slice(0, -1).join('/')

  let repos = repositories
  if (!repos.length) {
    // get maintained list if no values are passed
    repos = require('../public/data/maintained.json')
  }

  // populate repo map and unique labels
  for await (const repo of repos) {
    try {
      const ownerName = repo.repository.split('/').slice(-2)
      const owner = ownerName[0]
      const name = ownerName[1]
      const labels = await getRepoLabels(owner, name)
      if (labels.length) {
        repoLabelMap[`${owner}/${name}`] = { labels, owner, repo: name }
        labels.forEach((l) => {
          const current = uniqueLabels[l.name]
          const { name, description, color } = l
          if (!current) {
            uniqueLabels[l.name] = {
              name,
              description,
              color
            }
          }
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  const repoEntries = Object.entries(repoLabelMap)
  const uniqueLabelNames = Object.keys(uniqueLabels)

  // make request for each repository's missing labels ONLY
  for await (const [repo, data] of repoEntries) {
    try {
      const missing = uniqueLabelNames.filter((ulabel) => {
        return !data.labels.find((l) => l.name === ulabel)
      })
      if (!missing.length) {
        console.log(`${repo} labels up-to-date.`)
      } else {
        console.log(`Creating ${missing.length} labels for ${repo}`)
        const current = repoLabelMap[repo]
        const updates = missing.map((mlabel) =>
          createRepoLabel(current.owner, current.repo, uniqueLabels[mlabel])
        )
        await Promise.all(updates)
        sleep(300)
      }
    } catch (error) {
      console.error(error)
    }
  }

  writeFile(
    { data: Object.values(uniqueLabels), created_at: new Date().toISOString() },
    {
      dir,
      dest,
      latestJSON: dest
    }
  )
}

syncLabels()

module.exports = syncLabels
