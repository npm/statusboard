import * as util from './util.js'

export const keys = {
  count: '.count',
  trend: '.history',
  id: 'id',
}

export const overrides = {
  'status.conclusion': (metadata, data, row, ...args) => {
    if (row.name === 'statusboard') {
      const fetchData = metadata['fetch-data']
      const anyError = Object.values(metadata).find(d => d.error)

      const status = anyError ? 'failure' : 'success'
      const url = `${row.url}/actions/runs/${anyError?.id || fetchData?.id}`

      // Return same shape as the render function in datatables is expecting
      return [
        status,
        { ...row, status: { status, url } },
        ...args,
      ]
    }
  },
}

// this assumes that the repo also maintains a copy of template-oss
// this is not portable but for now the template/node version checks
// can be changed here or removed in the columns.js file
export const templateOSS = (projects) => projects.find((p) => p.name === 'template-oss')
export const templateVersion = (projects) => templateOSS(projects)?.version
export const nodeVersion = (projects) => templateOSS(projects)?.node

export const colId = (col) => `${typeof col === 'string' ? col : col.name}:name`

export const rowId = (row) => `#${typeof row === 'string' ? row : row.id}`

export const noArchived = (projects) => projects.every((p) => !p.archived)

export const isWorkspace = (p) => !!p.path

export const isPrivate = (p) => !!p.pkgPrivate

export const isPublished = (p) => !!p.lastPublished

export const wsDir = (p) => isWorkspace(p) ? p.path.substring(p.path.lastIndexOf('/') + 1) : null

export const names = (project) => {
  const pkgName = project.pkgName || ''
  // all our scopes should be the same or similar so dont use those for filtering/sorting
  const noScope = pkgName.split('/')[1] || pkgName
  // the repo name is the name of the folder for workspaces or the name of the repo
  const repoName = isWorkspace(project) ? wsDir(project) : project.name

  const allNames = util.uniq([pkgName, noScope, repoName])
  const noScopeNames = util.uniq([noScope, repoName])

  // a private pkg should only be looked up by repo name since the package.json might not be
  // relavant and for everything else display the full pkgname but filter without scope
  return !pkgName ? {
    display: repoName,
    filter: repoName,
    sort: repoName,
  } : {
    display: allNames[0],
    filter: noScopeNames,
    sort: noScopeNames[0],
  }
}
