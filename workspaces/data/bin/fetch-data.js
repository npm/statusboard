const path = require('path')
const { parseArgs } = require('util')
const writeJson = require('../lib/write-json.js')
const Api = require('../lib/api/rest.js')
const fetchData = require('../lib/project-data.js')
const logger = require('../lib/logger.js')
const getProjectsHistory = require('../lib/projects-history.js')
const pAll = require('../lib/p-all.js')
const wwwPaths = require('www')

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

const exec = async ({ auth, filter }) => {
  logger()

  const rawProjects = require(wwwPaths.maintained)
  // Make it easier to test by only fetching a subset of the projects
  const projects = filter ? rawProjects.filter(getFilter(filter)) : rawProjects

  const api = Api({ auth })
  const now = new Date()
  const dailyFile = wwwPaths.daily(now)

  const projectsHistory = await getProjectsHistory({
    projects,
    dir: wwwPaths.dailyDir,
    filter: (f) => f !== path.basename(dailyFile),
  })

  const projectsData = await pAll(projects.map((project) => () => {
    return fetchData({
      api,
      project,
      history: projectsHistory[project.id],
    })
  }))

  const results = await writeJson([
    { path: dailyFile, indent: 2 },
    { path: wwwPaths.latest, indent: 2 },
  ], {
    data: projectsData,
    created_at: now.toISOString(),
  })

  return results.map((f) => f.message).join('\n')
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    filter: {
      type: 'string',
    },
  },
})

exec({
  auth: process.env.AUTH_TOKEN,
  filter: values.filter,
})
  .then(console.log)
  .catch((err) => {
    process.exitCode = 1
    console.error(err)
  })
