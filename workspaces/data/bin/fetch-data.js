require('dotenv').config()

const path = require('path')
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

const writeData = async ({ delay, repoFilter, issueFilter, prFilter, issueAndPrQuery }) => {
  const rawProjects = require(wwwPaths.maintained)
  // Make it easier to test by only fetching a subset of the projects
  const projects = repoFilter ? rawProjects.filter(getFilter(repoFilter)) : rawProjects

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
    issueAndPrQuery,
    issueFilter,
    prFilter,
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

const main = async (retries = 1) => {
  const config = require('../lib/config.js')
  try {
    console.log(await writeData(config))
  } catch (err) {
    log.error(err)

    if (retries <= 2) {
      retries++
      const retryDelay = config.delay ? 1000 * 60 * 2 : 0
      log.warn(`Retry number ${retries} fetch-data script in ${retryDelay}ms`)
      return timers.setTimeout(retryDelay).then(() => main(retries))
    }

    process.exitCode = 1
  }
}

main()
