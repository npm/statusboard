const fs = require('fs')
const path = require('path')

const Api = require('../lib/api.js')
const logger = require('../lib/logger.js')

const { AUTH_TOKEN } = process.env

const sortKey = (p) => {
  const name = p.pkg ?? p.name
  return name.split('/')[1] ?? name
}

const exec = async ({ auth, destDir, query }) => {
  logger()

  const api = Api({ auth })
  const allProjects = await api.projects.searchWithManifests(query)

  const maintained = allProjects.filter((project, __, list) => {
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
  }).map(({ repo, pkg, manifest }) => ({
    name: repo.name,
    owner: repo.owner,
    ...(repo.isWorkspace ? { path: repo.path } : {}),
    ...(pkg?.private ? { private: true } : {}),
    ...(manifest ? { pkg: manifest.name } : {}),
  })).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

  if (!destDir) {
    return JSON.stringify(maintained, null, 2)
  }

  const dest = path.join(destDir, 'maintained.json')
  fs.writeFileSync(dest, JSON.stringify(maintained, null, 2))

  return `Wrote ${maintained.length} entries to ${path.relative(process.cwd(), dest)}`
}

exec({
  auth: AUTH_TOKEN,
  destDir: path.resolve(__dirname, '..', '..', 'www', 'lib', 'data'),
  query: 'org:npm topic:npm-cli',
}).then(console.log).catch(console.error)
