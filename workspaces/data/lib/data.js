const { pick } = require('lodash')
const semver = require('semver')

const getCoverage = require('./coverage.js')

const pAllObj = async (promises, data) => {
  const entries = Object.entries(promises)
  const res = await Promise.all(entries.map(([key, value]) => {
    if (typeof value === 'function') {
      return value(data).then(v => [key, v])
    }
    return [key, null]
  }))
  return Object.fromEntries(res)
}

const fetchAllRepoData = async ({ api, project: p }) => {
  const result = await pAllObj({
    commit: () => api.repo.commit(p.owner, p.name, p.path),
    ...(p.path ? {
      repo: () => api.repo.get(p.owner, p.name).then(r => pick(r, 'default_branch')),
    } : {
      repo: () => api.repo.get(p.owner, p.name),
      issues: () => api.issues.getAllOpen(p.owner, p.name),
    }),
    ...(p.pkg ? {
      pkg: () => api.package.manifest(p.pkg, { fullMetadata: true }),
      packument: () => api.package.packument(p.pkg, { fullMetadata: true }),
      downloads: () => api.package.downloads(p.pkg).then((d) => d.downloads),
    } : {
      pkg: () => api.repo.pkg(p.owner, p.name, p.path),
    }),
  })

  return {
    ...result,
    status: await api.repo.status(p.owner, p.name, result.commit?.sha ?? 'HEAD'),
  }
}

const parseIssuesAndPullRequests = ({ issues: items, repo }) => {
  if (!items) {
    return {}
  }

  const getUrl = (p = '', params = null) => {
    const url = new URL(repo.html_url + p)
    if (params) {
      url.search = (new URLSearchParams(params)).toString()
    }
    return url.toString()
  }

  const data = {
    issues: {
      count: 0,
      url: getUrl('/issues'),
    },
    prs: {
      count: 0,
      url: getUrl('/pulls'),
    },
    priority: {
      count: 0,
      url: getUrl('/issues', { q: 'is:issue is:open label:"Priority 1","Priority 0"' }),
    },
    triage: {
      count: 0,
      url: getUrl('/issues', { q: 'is:issue is:open label:"Needs Triage"' }),
    },
    noLabel: {
      count: 0,
      url: getUrl('/issues', { q: 'is:issue is:open no:label' }),
    },
  }

  for (const item of items) {
    const labels = item.labels.map(l => l.name)

    if (Object.hasOwn(item, 'pull_request')) {
      data.prs.count++
      if (!data.pendingRelease && labels.includes('autorelease: pending')) {
        data.pendingRelease = {
          url: item.url,
          title: item.title.match(semver.re[semver.tokens.FULLPLAIN])?.[0] || item.title,
        }
      }
    } else {
      data.issues.count++
      if (!labels.length) {
        data.noLabel.count++
      }
      if (labels.includes('Priority 0') || labels.includes('Priority 1')) {
        data.priority.count++
      }
      if (labels.includes('Needs Triage')) {
        data.triage.count++
      }
    }
  }

  return data
}

module.exports = async ({ api, project }) => {
  const {
    commit,
    repo,
    issues,
    pkg,
    packument,
    downloads,
    status,
  } = await fetchAllRepoData({ api, project })

  const license = [pkg?.license, repo?.license?.spdx_id]
    .filter((l) => l && l !== 'NOASSERTION')

  const url = new URL(`/${project.owner}/${project.name}`, 'https://github.com')
  if (project.path) {
    url.pathname += `/tree/${repo.default_branch}/${project.path}`
  }

  return {
    name: project.name,
    owner: project.owner,
    path: project.path ?? null,
    pkgPrivate: project.private ?? false,
    defaultBranch: repo.default_branch,
    url: url.toString(),
    version: pkg?.version ?? null,
    pkgName: pkg?.name ?? null,
    size: pkg?.dist?.unpackedSize ?? null,
    status: status ? { url: status.html_url, conclusion: status.conclusion } : null,
    stars: repo?.stargazers_count ?? null,
    coverage: getCoverage(pkg) ?? null,
    license: license[0] ?? null,
    lastPublished: packument?.time?.[packument?.['dist-tags'].latest] ?? null,
    lastPush: commit ? { date: commit.commit.author.date, url: commit.html_url } : null,
    node: pkg?.engines?.node ?? null,
    templateVersion: pkg?.templateOSS?.version ?? null,
    downloads: downloads ?? null,
    ...parseIssuesAndPullRequests({ issues, repo }),
  }
}
