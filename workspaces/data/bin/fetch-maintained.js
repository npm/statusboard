const path = require('path')
const { parseArgs } = require('util')
const Api = require('../lib/api.js')
const logger = require('../lib/logger.js')
const writeJson = require('../lib/write-json.js')

const sortKey = (p) => {
  const name = p.pkg ?? p.name
  return name.split('/')[1] ?? name
}

const exec = async ({ auth, query, projects: projectsFile }) => {
  logger()

  const api = Api({ auth })
  const allProjects = await api.projects.searchWithManifests(query)

  const maintainedProjects = allProjects.filter((project, __, list) => {
    if (project.repo.isWorkspace && !project.manifest && project.pkg?.private) {
      // These are workspaces within a repo that are not published
      // to the registry. There might be something to track here
      // such as check_runs, coverage, etc that would be specific
      // to this directory, but for now just ignore them. Most of
      // these metrics should bubble up to the top level repo which
      // we do track.
      return false
    }

    if (
      project.repo.isArchived &&
      list.some((r) => r.manifest?.name === project.pkg?.name)
    ) {
      // These are repos that were archived and moved to a different repo
      // as a workspace. These have nothing worth tracking but we keep the
      // topic on there as a signal that we did own it previously. And so
      // we can I track whether the corresponding package gets deprecated.
      return false
    }

    return true
  })

  // This should not have any ephemeral data in it
  // since it is only used to store a list of all projects that
  // we maintain and all the data is fetched as part of another script
  const maintained = maintainedProjects.map(({ repo, manifest }) => ({
    id: `${repo.owner}/${repo.name}${repo.path ? `/${repo.path}` : ''}`,
    name: repo.name,
    owner: repo.owner,
    ...(repo.isWorkspace ? { path: repo.path } : {}),
    ...(manifest ? { pkg: manifest.name } : {}),
  }))

  maintained.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  const results = await writeJson([{ path: projectsFile, indent: 2 }], maintained)
  return results.map((f) => f.message).join('\n')
}

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    projects: {
      type: 'string',
    },
    query: {
      type: 'string',
    },
  },
})

exec({
  auth: process.env.AUTH_TOKEN,
  projects: values.projects ?? path.resolve(__dirname, '../../www/lib/data/maintained.json'),
  query: values.query ?? 'org:npm topic:npm-cli',
})
  .then(console.log)
  .catch(console.error)
