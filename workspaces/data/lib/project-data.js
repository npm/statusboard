const { pick, partition } = require('lodash')
const semver = require('semver')
const getCoverage = require('./coverage.js')
const pAll = require('./p-all.js')
const getIssues = require('./issues.js')
const getPrs = require('./prs.js')
const packageApi = require('./api/package.js')

const semverRe = semver.re[semver.tokens.FULLPLAIN]

const fetchAllRepoData = async ({ api, delay, project: p }) => {
  const { issuesAndPrs, ...result } = await pAll({
    commit: () => api.repo.commit(p.owner, p.name, p.path),
    ...(p.path ? {
      // pick properties that we need for a workspace but exclude
      // others since we display workspaces differently
      repo: () => api.repo.get(p.owner, p.name)
        .then(r => pick(r, 'default_branch', 'html_url', 'archived')),
    } : {
      repo: () => api.repo.get(p.owner, p.name),
      issuesAndPrs: () => api.issues.getAllOpen(p.owner, p.name),
    }),
    repoPkg: () => api.repo.pkg(p.owner, p.name, p.path),
    ...(p.pkg ? {
      manifest: () => packageApi.manifest(p.pkg, { fullMetadata: true }),
      packument: () => packageApi.packument(p.pkg, { fullMetadata: true }),
      downloads: () => packageApi.downloads(p.pkg).then((d) => d.downloads),
    } : {}),
  }, { delay })

  if (issuesAndPrs) {
    const [prs, issues] = partition(issuesAndPrs, (item) => Object.hasOwn(item, 'pull_request'))
    result.prs = prs
    result.issues = issues
  }

  result.status = await api.repo.status(p.owner, p.name, result.commit.sha)

  return result
}

module.exports = async ({ api, project, history, delay }) => {
  const {
    commit,
    repo,
    issues,
    prs,
    repoPkg,
    manifest,
    packument,
    downloads,
    status,
  } = await fetchAllRepoData({ api, delay, project })

  const license = [repoPkg?.license, repo.license?.spdx_id]
    .filter((l) => l && l !== 'NOASSERTION')

  const repoUrl = new URL(`/${project.owner}/${project.name}`, 'https://github.com')
  const fullUrl = new URL(repoUrl)
  if (project.path) {
    fullUrl.pathname += `/tree/${repo.default_branch}/${project.path}`
  }

  const releasePr = prs?.find((pr) => pr.labels.find((l) => l.name === 'autorelease: pending'))
  const pendingRelease = releasePr && {
    url: releasePr.url,
    version: releasePr.title.match(semverRe)?.[0] || releasePr.title,
  }

  const stars = typeof repo.stargazers_count === 'number' ? {
    count: repo.stargazers_count,
    url: `${repoUrl}/stargazers`,
  } : null

  const fullStatus = status ? {
    url: status.url ?? `${repoUrl}/actions`,
    conclusion: status.conclusion,
  } : null

  return {
    // project info comes directly from the maintained.json file
    // and is considered the source of truth for the name/owner
    id: project.id,
    name: project.name,
    owner: project.owner,
    path: project.path ?? null,
    // repo data
    defaultBranch: repo.default_branch,
    url: fullUrl.toString(),
    lastPush: { date: commit.commit.author.date, url: commit.html_url },
    archived: repo.archived,
    status: fullStatus,
    stars,
    // package.json
    // these properties come from the repo pkg json since that
    // will usually be more up to date for things like templateVersion
    // that doesn't always trigger a release
    pkgPrivate: repoPkg?.private ?? false,
    pkgName: repoPkg?.name ?? null,
    coverage: getCoverage(repoPkg) ?? null,
    templateVersion: repoPkg?.templateOSS?.version ?? null,
    license: license[0] ?? null,
    node: repoPkg?.engines?.node ?? null,
    // registry
    // we get both the registry info and the package.json from the repo
    // but we use version as a signal of the published version so only
    // get that data from the published manifest
    version: manifest?.version ?? null,
    lastPublished: packument?.time?.[manifest.version] ?? null,
    size: manifest?.dist?.unpackedSize ?? null,
    pkgUrl: manifest?.name ? `https://www.npmjs.com/package/${manifest.name}` : null,
    deprecated: manifest?.deprecated ?? false,
    downloads: downloads ?? null,
    // issues and prs
    pendingRelease: pendingRelease ?? null,
    prs: getPrs({
      prs,
      url: repo.html_url,
      history: history?.map((p) => p.prs),
    }) ?? null,
    issues: getIssues({
      issues,
      url: repo.html_url,
      history: history?.map((p) => p.issues),
    }) ?? null,
  }
}
