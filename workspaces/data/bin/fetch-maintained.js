const { parseArgs } = require('util')
const log = require('proc-log')
const Api = require('../lib/api/graphql.js')
const logger = require('../lib/logger.js')
const writeJson = require('../lib/write-json.js')
const wwwPaths = require('www')

const sortKey = (p) => {
  const name = p.pkg ?? p.name
  return name.split('/')[1] ?? name
}

const projectId = ({ repo }) =>
  `${repo.owner}_${repo.name}${repo.path ? `_${repo.path.replace(/\//g, '_')}` : ''}`

const exec = async ({ auth, query }) => {
  logger()

  const api = Api({ auth })
  const allProjects = await api.searchReposWithManifests(query)

  const maintainedProjects = allProjects.filter((project) => {
    const logReason = (reason) =>
      log.info('fetch:maintained', `Not including ${projectId(project)} due to: ${reason}`)

    if (project.repo.isWorkspace && !project.manifest && project.pkg?.private) {
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

    if (project.repo.isArchived && matchingWorkspace) {
      logReason('moved to workspace')
      // These are repos that were archived and moved to a different repo
      // as a workspace. These have nothing worth tracking but we keep the
      // topic on there as a signal that we did own it previously. And so
      // we can I track whether the corresponding package gets deprecated.
      return false
    }

    if (project.repo.isArchived && project.manifest?.deprecated) {
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
  const results = await writeJson([{ path: wwwPaths.maintained, indent: 2 }], maintained)
  return results.map((f) => f.message).join('\n')
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    query: {
      type: 'string',
    },
  },
})

exec({
  auth: process.env.AUTH_TOKEN,
  query: values.query ?? 'org:npm topic:npm-cli fork:true',
})
  .then(console.log)
  .catch((err) => {
    process.exitCode = 1
    console.error(err)
  })
