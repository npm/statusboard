const path = require('path')
const { parseArgs } = require('util')
const timers = require('timers/promises')
const log = require('proc-log')
const writeJson = require('../lib/write-json.js')
const Api = require('../lib/api/index.js')
const fetchData = require('../lib/project-data.js')
const logger = require('../lib/logger.js')
const getProjectsHistory = require('../lib/projects-history.js')
const pAll = require('../lib/p-all.js')
const wwwPaths = require('www')

logger()
const api = Api({ auth: process.env.AUTH_TOKEN })

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

const exec = async ({ filter, delay }) => {
  const rawProjects = require(wwwPaths.maintained)
  // Make it easier to test by only fetching a subset of the projects
  const projects = filter ? rawProjects.filter(getFilter(filter)) : rawProjects

  const now = new Date()
  const dailyFile = wwwPaths.daily(now)

  const projectsHistory = await getProjectsHistory({
    projects,
    dir: wwwPaths.dailyDir,
    filter: (f) => f !== path.basename(dailyFile),
  })

  const projectsData = await pAll(projects.map((project) => () => fetchData({
    api,
    project,
    delay,
    history: projectsHistory[project.id],
  })), { delay })

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
    delay: {
      type: 'string',
    },
  },
})

const delay = values.delay ? +values.delay : 1000

const main = (retries = 1) => exec({
  filter: values.filter,
  delay,
})
  .then(console.log)
  .catch((err) => {
    log.error(err)

    if (retries <= 2) {
      const retryDelay = delay ? 1000 * 60 * 2 : 0
      log.warn(`Retry number ${retries} fetch-data script in ${retryDelay}ms`)
      return timers.setTimeout(retryDelay, retries++).then(main)
    }

    process.exitCode = 1
  })

main()
