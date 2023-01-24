
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
const config = require('../lib/config.js')
const updateMetadata = require('../lib/update-metadata.js')

logger()
const metadata = updateMetadata(__filename)
const api = Api(config)

const getProjects = (query) => {
  const projects = require(wwwPaths.maintained)
  const projectKeys = projects.reduce((set, p) => {
    for (const k of Object.keys(p)) {
      set.add(k)
    }
    return set
  }, new Set())
  // This reuses the repoQuery config but only looks at query parts that indicate
  // a specific repo. This is because this reads from our `maintained.json` list
  // but sometimes during debugging we want to isolate a specific repo to test its
  // data, eg `npm run -w data fetch:data -- --repoQuery='id:npm_cli'`
  const filter = query.split(' ').map(q => {
    const [key, value] = q.split(':')
    if (projectKeys.has(key)) {
      return (p) => p[key] === value
    }
  }).filter(Boolean)
  return filter.length ? projects.filter(p => filter.some(fn => fn(p))) : projects
}

const writeData = async ({ write, ...restConfig }) => {
  const projects = getProjects(restConfig.repoQuery)

  const dailyFile = wwwPaths.daily(metadata.date)

  const projectsHistory = await getProjectsHistory({
    projects,
    dir: wwwPaths.dailyDir,
    filter: (f) => f !== path.basename(dailyFile),
  })

  const projectsData = await pAll(projects.map((project) => () => fetchData({
    api,
    project,
    history: projectsHistory[project.id],
    ...restConfig,
  })))

  const contents = projectsData

  if (!write) {
    return JSON.stringify(contents, null, 2)
  }

  const results = await writeJson([
    { path: dailyFile, indent: 2 },
    { path: wwwPaths.latest, indent: 2 },
  ], contents)

  return {
    message: results.map((f) => f.message).join('\n'),
  }
}

const main = async (currentRun = 0) => {
  currentRun++

  log.info('='.repeat(80))
  log.info('='.repeat(80))
  log.info(`Starting: run number ${currentRun} at ${new Date().toISOString()}`)
  log.info('='.repeat(80))
  log.info('='.repeat(80))

  try {
    return await writeData(config)
  } catch (err) {
    log.error(err)
    log.error('status', err.status)

    if (err.status === 403 && currentRun <= 5) {
      const retryDelay = config.delay ? 1000 * 60 * 10 : 0
      log.warn('='.repeat(80))
      log.warn('='.repeat(80))
      log.warn(`Retrying: run number ${currentRun} fetch-data script in ${retryDelay}ms`)
      log.warn('='.repeat(80))
      log.warn('='.repeat(80))
      return timers.setTimeout(retryDelay).then(() => main(currentRun))
    }

    throw err
  }
}

main()
  .then((res) => {
    console.log(res.message)
    return metadata.save({ status: 'success' })
  })
  .catch(async (err) => {
    await metadata.save({ status: 'error' })
    throw err
  })
