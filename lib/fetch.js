const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const dateFns = require('date-fns')

const latestJSON = '../public/data/latest.json'
const now = new Date()
const month = String('00' + (now.getUTCMonth() + 1)).slice(-2)
const dest = `../public/data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
const dir = dest.split('/').slice(0, -1).join('/')

const writeFile = (data) => {
  mkdirp(path.resolve(__dirname, dir))
    .then(() => {
      fs.writeFileSync(
        path.resolve(__dirname, dest),
        JSON.stringify(data.data),
        'utf8'
      )
      fs.writeFileSync(
        path.resolve(__dirname, latestJSON),
        JSON.stringify(data),
        'utf8'
      )
    })
    .catch((err) => console.error(err))
}

const mapToResponse = (pkgName = '', data) => {
  const {
    repoData,
    owner,
    name,
    prCount,
    coverage,
    nodeVersion,
    pkg,
    highPrioIssues,
    needsTriageIssues,
    deployments,
    downloads
  } = data

  return {
    ...repoData,
    owner,
    name,
    package: pkgName,
    prs_count: prCount >= 100 ? '100+' : prCount,
    issues_count: repoData.open_issues_count,
    pushed_at_diff: dateFns.formatDistanceToNow(new Date(repoData.pushed_at), {
      addSuffix: false,
      includeSeconds: false
    }),
    coverage,
    coverageLevel: coverage
      ? coverage === 100
        ? 'high'
        : coverage > 80
          ? 'medium'
          : 'low'
      : '',
    node: nodeVersion,
    license: repoData.license
      ? {
          ...repoData.license,
          key:
            repoData.license.spdx_id !== 'NOASSERTION'
              ? repoData.license.spdx_id
              : null
        }
      : {},
    version: pkg ? pkg.version : null,
    downloads: downloads && downloads.downloads ? downloads.downloads : 0,
    high_priority_issues_count: highPrioIssues.length,
    needs_triage_issues_count: needsTriageIssues.length,
    deployment_status: deployments.data.state
  }
}

module.exports = {
  writeFile,
  mapToResponse
}
