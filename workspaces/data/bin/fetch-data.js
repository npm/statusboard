const fs = require('fs/promises')
const path = require('path')
const mkdirp = require('mkdirp')

const Api = require('../lib/api.js')
const fetchData = require('../lib/data.js')
const logger = require('../lib/logger.js')
const allProjects = require('../../www/lib/data/maintained.json')

const { AUTH_TOKEN, FILTER } = process.env

const getDate = (d) => ({
  month: (d.getUTCMonth() + 1).toString().padStart(2, '0'),
  year: d.getUTCFullYear().toString(),
  day: d.getUTCDate().toString().padStart(2, '0'),
  iso: d.toISOString(),
})

const getFilter = (rawFilter) => {
  if (!isNaN(rawFilter) && !isNaN(parseFloat(rawFilter))) {
    return (_, index) => index < +rawFilter
  }

  const names = rawFilter.split(',').map((name) => name.trim().toLowerCase())
  return (project) => {
    const name = project.pkg ?? project.name
    return names.includes(name.toLowerCase())
  }
}

const exec = async ({ auth, destDir, projects }) => {
  logger()

  const api = Api({ auth })

  const data = []
  for (const project of projects) {
    data.push(await fetchData({ api, project }))
  }

  if (!destDir) {
    return JSON.stringify(data, null, 2)
  }

  const { year, month, day, iso } = getDate(new Date())
  const contents = { data, created_at: iso }

  const files = [
    path.join(destDir, year, month, `${day}.json`),
    path.join(destDir, 'latest.json'),
    path.join(destDir, 'debug.json'),
  ]

  const res = await Promise.all(files.map(async (f) => {
    const indent = f.endsWith('debug.json') ? 2 : 0
    await mkdirp(path.dirname(f))
    await fs.writeFile(f, JSON.stringify(contents, null, indent), 'utf-8')
    return path.relative(process.cwd(), f)
  }))

  return res.map((f) => `Wrote to ${data.length} entries to ${f}`).join('\n')
}

exec({
  auth: AUTH_TOKEN,
  // Make it easier to test by only fetching a subset of the repos
  destDir: path.resolve(__dirname, '..', '..', 'www', 'lib', 'data'),
  projects: FILTER ? allProjects.filter(getFilter(FILTER)) : allProjects,
}).then(console.log).catch(console.error)
