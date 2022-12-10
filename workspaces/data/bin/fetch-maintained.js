
const log = require('proc-log')
const Api = require('../lib/api/index.js')
const logger = require('../lib/logger.js')
const writeJson = require('../lib/write-json.js')
const wwwPaths = require('www')
const config = require('../lib/config.js')
const updateMetadata = require('../lib/update-metadata.js')

logger()
const api = Api(config)
const metadata = updateMetadata(__filename)

const sortKey = (p) => {
  const name = p.pkg ?? p.name
  return name.split('/')[1] ?? name
}

const projectId = ({ repo }) =>
  `${repo.owner}_${repo.name}${repo.path ? `_${repo.path.replace(/\//g, '_')}` : ''}`

const getCurrentMaintained = () => {
  try {
    return require(wwwPaths.maintained).length
  } catch {
    return 0
  }
}

const exec = async ({ write, repoQuery, repoFilter }) => {
  const currentCount = getCurrentMaintained()
  const allProjects = await api.searchReposWithManifests(repoQuery)

  const maintainedProjects = allProjects.filter((project) => {
    const logReason = (reason, include) => log.info(
      'fetch:maintained',
      `${include ? '' : 'not'} including ${projectId(project)} due to: ${reason}`.trim()
    )

    const filterResult = repoFilter(project)
    if (typeof filterResult === 'boolean') {
      logReason('filter config', filterResult)
      return filterResult
    }

    const notPublished = !project.manifest
    const private = project.pkg?.private
    const deprecated = project.manifest?.deprecated
    const archived = project.repo.isArchived

    if (project.repo.isWorkspace && notPublished && private) {
      logReason('private workspace')
      // These are workspaces within a repo that are not published
      // to the registry. There might be something to track here
      // such as check_runs, coverage, etc that would be specific
      // to this directory, but for now just ignore them. Most of
      // these metrics should bubble up to the top level repo which
      // we do track.
      return false
    }

    const matchingWorkspace = allProjects.find((p) => {
      return p.repo.isWorkspace && p.manifest && p.manifest.name === project.manifest?.name
    })

    if (archived && matchingWorkspace) {
      logReason('moved to workspace')
      // These are repos that were archived and moved to a different repo
      // as a workspace. These have nothing worth tracking but we keep the
      // topic on there as a signal that we did own it previously. And so
      // we can I track whether the corresponding package gets deprecated.
      return false
    }

    if (archived && (notPublished || deprecated || private)) {
      logReason('archived and deprecated')
      // Remove repos that are achived and the published package has been deprecated
      // This way we don't have to remove any topics on GH repos but we can safely
      // ignore any signals from these projects. As Myles would say:
      // "You can safely ignore me"
      return false
    }

    return true
  })

  // This should not have any ephemeral data in it
  // since it is only used to store a list of all projects that
  // we maintain and all the data is fetched as part of another script
  const maintained = maintainedProjects.map((project) => ({
    // id needs to be a valid CSS selector
    id: projectId(project),
    name: project.repo.name,
    owner: project.repo.owner,
    ...(project.repo.isWorkspace ? { path: project.repo.path } : {}),
    ...(project.manifest ? { pkg: project.manifest.name } : {}),
  }))

  maintained.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  log.info('fetch:maintained', `Found ${maintained.length} maintained projects`)

  if (!write) {
    return JSON.stringify(maintained, null, 2)
  }

  const results = await writeJson([{ path: wwwPaths.maintained, indent: 2 }], maintained)

  return {
    update: maintained.length - currentCount,
    message: results.map((f) => f.message).join('\n'),
  }
}

exec(config)
  .then((res) => {
    console.log(res.message)
    return metadata.save({ status: 'success', update: res.update })
  })
  .catch(async (err) => {
    log.error(err)
    await metadata.save({ status: 'error' })
    throw err
  })
