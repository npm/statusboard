const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const dateFns = require('date-fns')

const writeFile = (data, { dir, dest, latestJSON }) => {
  return mkdirp(path.resolve(__dirname, dir)).then(() => {
    if (data.data) {
      fs.writeFileSync(path.resolve(__dirname, dest), JSON.stringify(data.data), 'utf8')
      if (latestJSON) {
        fs.writeFileSync(path.resolve(__dirname, latestJSON), JSON.stringify(data), 'utf8')
      }
    }
  })
}

const getLicense = (pkg, repo) => {
  let result = { key: '' }
  if (pkg && pkg.license) {
    result.key = pkg.license
  } else if (!pkg && repo && repo.license) {
    result = {
      ...repo.license,
      key: repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : ''
    }
  }
  return result
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
    noLabelIssuesCount,
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
    coverageLevel: coverage ? (coverage === 100 ? 'high' : coverage > 80 ? 'medium' : 'low') : '',
    node: nodeVersion,
    license: getLicense(pkg, repoData),
    version: pkg ? pkg.version : null,
    downloads: downloads && downloads.downloads ? downloads.downloads : 0,
    high_priority_issues_count: highPrioIssues || 0,
    needs_triage_issues_count: needsTriageIssues || 0,
    no_label_issues_count: noLabelIssuesCount || 0,
    deployment_status: deployments.data.state
  }
}

module.exports = {
  writeFile,
  mapToResponse
}
