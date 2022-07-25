const { pick, partition } = require('lodash')
const semver = require('semver')
const getCoverage = require('./coverage.js')
const pAll = require('./p-all.js')
const getIssues = require('./issues.js')
const getPrs = require('./prs.js')

const semverRe = semver.re[semver.tokens.FULLPLAIN]

const fetchAllRepoData = async ({ api, project: p }) => {
  const { issuesAndPrs, ...result } = await pAll({
    commit: () => api.repo.commit(p.owner, p.name, p.path),
    ...(p.path ? {
      repo: () => api.repo.get(p.owner, p.name).then(r => pick(r, 'default_branch', 'html_url')),
    } : {
      repo: () => api.repo.get(p.owner, p.name),
      issuesAndPrs: () => api.issues.getAllOpen(p.owner, p.name),
    }),
    ...(p.pkg ? {
      pkg: () => api.package.manifest(p.pkg, { fullMetadata: true }),
      packument: () => api.package.packument(p.pkg, { fullMetadata: true }),
      downloads: () => api.package.downloads(p.pkg).then((d) => d.downloads),
    } : {
      pkg: () => api.repo.pkg(p.owner, p.name, p.path),
    }),
  })

  if (issuesAndPrs) {
    const [prs, issues] = partition(issuesAndPrs, (item) => Object.hasOwn(item, 'pull_request'))
    result.prs = prs
    result.issues = issues
  }

  return {
    ...result,
    status: await api.repo.status(p.owner, p.name, result.commit?.sha ?? 'HEAD'),
  }
}

module.exports = async ({ api, project, history }) => {
  const {
    commit,
    repo,
    issues,
    prs,
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

  const releasePr = prs?.find((pr) => pr.labels.find((l) => l.name === 'autorelease: pending'))
  const pendingRelease = releasePr && {
    url: releasePr.url,
    title: releasePr.title.match(semverRe)?.[0] || releasePr.title,
  }

  return {
    // repo
    id: project.id,
    name: project.name,
    owner: project.owner,
    path: project.path ?? null,
    defaultBranch: repo.default_branch,
    url: url.toString(),
    lastPush: commit ? { date: commit.commit.author.date, url: commit.html_url } : null,
    status: status ? { url: status.html_url, conclusion: status.conclusion } : null,
    stars: repo?.stargazers_count ?? null,
    // package.json
    pkgPrivate: pkg?.private ?? false,
    pkgName: pkg?.name ?? null,
    coverage: getCoverage(pkg) ?? null,
    templateVersion: pkg?.templateOSS?.version ?? null,
    license: license[0] ?? null,
    node: pkg?.engines?.node ?? null,
    // registry
    // we get both the registry info and the package.json from the repo
    // but we use version as a signal of the published version so only
    // get that data from the published packument
    version: packument?.['dist-tags'].latest ?? null,
    size: pkg?.dist?.unpackedSize ?? null,
    downloads: downloads ?? null,
    lastPublished: packument?.time?.[packument?.['dist-tags'].latest] ?? null,
    pkgUrl: pkg?.name ? `https://www.npmjs.com/package/${pkg.name}` : null,
    // issues and prs
    pendingRelease: pendingRelease ?? null,
    prs: getPrs({ prs, repo, history: history?.map((p) => p.prs) }) ?? null,
    issues: getIssues({ issues, repo, history: history?.map((p) => p.issues) }) ?? null,
  }
}
