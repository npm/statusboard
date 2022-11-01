const { pick, partition } = require('lodash')
const getCoverage = require('./coverage.js')
const pAll = require('./p-all.js')
const filterCollection = require('./filter-collection.js')

const fetchAllRepoData = async ({ api, project: p, issueAndPrQuery, discussionQuery }) => {
  const { issuesAndPrs, ...result } = await pAll({
    commit: () => api.getCommit(p.owner, p.name, p.path),
    ...(p.path ? {
      // pick properties that we need for a workspace but exclude
      // others since we display workspaces differently
      repo: () => api.getRepo(p.owner, p.name)
        .then(r => pick(r, 'default_branch', 'html_url', 'archived')),
    } : {
      repo: () => api.getRepo(p.owner, p.name),
      issuesAndPrs: () => api.getAllIssuesAndPullRequests(p.owner, p.name, issueAndPrQuery),
      discussions: () => api.getDiscussions(p.owner, p.name, discussionQuery),
    }),
    repoPkg: () => api.getPkg(p.owner, p.name, p.path),
    ...(p.pkg ? {
      manifest: () => api.manifest(p.pkg, { fullMetadata: true }),
      packument: () => api.packument(p.pkg, { fullMetadata: true }),
      downloads: () => api.downloads(p.pkg).then((d) => d.downloads),
    } : {}),
  })

  if (issuesAndPrs) {
    const [prs, issues] = partition(issuesAndPrs, (item) => Object.hasOwn(item, 'pull_request'))
    result.prs = prs
    result.issues = issues
  }

  result.status = await api.getStatus(p.owner, p.name, result.commit.sha)

  return result
}

module.exports = async ({
  api,
  project,
  history,
  issueFilter,
  prFilter,
  discussionFilter,
  issueAndPrQuery,
  discussionQuery,
}) => {
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
    discussions,
  } = await fetchAllRepoData({ api, project, issueAndPrQuery, discussionQuery })

  const license = [{ key: repoPkg?.license }, repo.license]
    .filter(l => l?.key).map((l) => l.key.toUpperCase())

  const repoUrl = new URL(`/${project.owner}/${project.name}`, 'https://github.com')
  const pathUrl = new URL(repoUrl)
  if (project.path) {
    pathUrl.pathname += `/tree/${repo.default_branch}/${project.path}`
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
    url: pathUrl.toString(),
    lastPush: { date: commit.commit.author.date, url: commit.html_url },
    archived: repo.archived,
    status: fullStatus,
    stars,
    // package.json
    // these properties come from the repo pkg json since that
    // will usually be more up to date for things like templateVersion
    // that doesn't always trigger a release
    // no package.json means it is private since it wont get published
    pkgPrivate: repoPkg ? repoPkg.private ?? false : true,
    pkgName: repoPkg?.name ?? null,
    coverage: repoPkg ? getCoverage(repoPkg) : null,
    templateVersion: repoPkg ? repoPkg.templateOSS?.version ?? '' : null,
    license: license[0] ?? null,
    node: repoPkg ? repoPkg.engines?.node ?? '' : null,
    // registry
    // we get both the registry info and the package.json from the repo
    // but we use version as a signal of the published version so only
    // get that data from the published manifest
    version: manifest?.version ?? null,
    repoVersion: repoPkg?.version ?? null,
    lastPublished: packument?.time?.[manifest.version] ?? null,
    size: manifest?.dist?.unpackedSize ?? null,
    pkgUrl: manifest?.name ? `https://www.npmjs.com/package/${manifest.name}` : null,
    deprecated: manifest?.deprecated ?? false,
    downloads: downloads ?? null,
    // issues and prs
    discussions: filterCollection({
      items: discussions,
      url: new URL(repo.html_url + `/discussions?discussions_q=`),
      history: history?.map((p) => p.discussions),
      filters: discussionFilter,
    }) ?? null,
    prs: filterCollection({
      items: prs,
      url: new URL(repo.html_url + `/pulls?q=${issueAndPrQuery}`),
      history: history?.map((p) => p.prs),
      filters: prFilter,
    }) ?? null,
    issues: filterCollection({
      items: issues,
      url: new URL(repo.html_url + `/issues?q=${issueAndPrQuery}`),
      history: history?.map((p) => p.issues),
      filters: issueFilter,
    }) ?? null,
  }
}
