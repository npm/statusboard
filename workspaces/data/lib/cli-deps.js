import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import Arborist from '@npmcli/arborist'
import semver from 'semver'
import pLog from 'proc-log'
import policy from './cli-deps-policy.js'

const batches = (values, size) => Array.from(
  { length: Math.ceil(values.length / size) },
  (_, index) => values.slice(index * size, (index + 1) * size)
)

const mapLimit = async (values, callback) => {
  const results = new Array(values.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, async () => {
    while (next < values.length) {
      const index = next++
      results[index] = await callback(values[index], index)
    }
  }))
  return results
}

export const repositoryName = (repository) => {
  let value = typeof repository === 'string' ? repository : repository?.url
  if (!value) {
    return null
  }
  value = value.replace(/^git\+/, '').replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^github:/, 'https://github.com/')
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) {
    value = `https://github.com/${value}`
  }
  const url = URL.parse(value)
  const match = url?.pathname.match(/^\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/|$)/)
  return url?.hostname === 'github.com' && match ? `${match[1]}/${match[2]}` : null
}

export const traceTree = (root, excludedPackage) => {
  const queue = [root]
  const previous = new Map([[root, null]])
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]
    if (node.packageName === excludedPackage) {
      continue
    }
    for (const edge of node.edgesOut.values()) {
      const target = edge.to?.target
      if (target && !previous.has(target)) {
        previous.set(target, node)
        queue.push(target)
      }
    }
  }
  return node => {
    if (!previous.has(node)) {
      return null
    }
    const chain = []
    for (let current = node; current; current = previous.get(current)) {
      chain.push(`${current.packageName}@${current.version}`)
    }
    return chain.reverse().join(' -> ')
  }
}

export const readOccurrences = async (line, excludedPackage) => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'statusboard-cli-deps-'))
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(line.manifest))
    await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify(line.lock))
    for (const workspace of line.workspaces) {
      assert(!path.isAbsolute(workspace.location) &&
        !workspace.location.split(/[\\/]/).includes('..'), 'Invalid workspace path')
      const directory = path.join(root, workspace.location)
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(workspace.manifest))
    }
    const tree = await new Arborist({ path: root }).loadVirtual()
    const allPaths = traceTree(tree)
    const retainedPaths = traceTree(tree, excludedPackage)
    const nodes = new Map([...tree.inventory.values()]
      .filter(node => !node.isLink).map(node => [node.location, node]))
    const occurrences = []
    let excludedOccurrences = 0
    for (const [location, entry] of Object.entries(line.lock.packages)) {
      if (!location || entry.link) {
        continue
      }
      const workspace = line.workspaces.find(item => item.location === location)
      if (workspace?.manifest.private) {
        continue
      }
      const node = nodes.get(location)
      assert(node, `${line.branch}: missing virtual node ${location}`)
      assert.equal(node.version, entry.version, `${line.branch}: inconsistent lock at ${location}`)
      assert(semver.valid(node.version), `${node.packageName}: non-semver integration ${node.version}`)
      assert(allPaths(node), `${line.branch}: unreachable lock entry ${location}`)
      const trace = retainedPaths(node)
      if (!trace) {
        assert(entry.dev, `${line.branch}: exclusion would remove runtime dependency ${location}`)
        excludedOccurrences++
        continue
      }
      occurrences.push({
        package: workspace?.manifest.name || entry.name || node.packageName,
        version: node.version,
        cliMajor: line.major,
        cliBranch: line.branch,
        location,
        production: !entry.dev,
        workspace,
        path: trace,
      })
    }
    return { occurrences, excludedOccurrences }
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

const stableBranch = branch => branch.default || branch.name === 'latest' ||
  /^(?:(?:release|lts)[/-])?v?\d+(?:\.x)?$/.test(branch.name)

export const makeMatrix = ({ records, repositories, versions, lines, checkedAt }) => {
  const majors = lines.map(line => line.major)
  const emptyBuckets = () => Object.fromEntries(majors.map(major => [major, []]))
  const rows = new Map()
  for (const record of records) {
    const repo = repositories.get(record.repository)
    const available = repo.manifests.filter(file =>
      stableBranch(file.branch) && file.manifest?.name === record.name &&
      semver.valid(file.manifest.version))
    for (const occurrence of record.occurrences) {
      const major = semver.major(occurrence.version)
      const candidates = available.filter(file => semver.major(file.manifest.version) === major)
      const own = record.repository === policy.repository &&
        candidates.find(file => file.branch.name === occurrence.cliBranch)
      const branch = own || candidates.find(file => file.branch.default) ||
        candidates.find(file => file.branch.name === `release/v${major}`) ||
        candidates.find(file => file.branch.name === `v${major}`) ||
        candidates.find(file => file.branch.name === `${major}.x`) || candidates[0]
      const key = `${record.name}:${major}:${branch?.branch.name || 'missing'}`
      if (!rows.has(key)) {
        rows.set(key, {
          repository: record.repository,
          package: record.name,
          packageMajor: major,
          branch: branch?.branch.name || null,
          requiredBranch: branch ? null : `release/v${major}`,
          branchCurrentVersion: branch?.manifest.version || null,
          branchCommit: branch?.branch.commit || null,
          manifestPath: branch?.file || null,
          published: versions.get(record.name).majors[major] || null,
          integrated: emptyBuckets(),
          paths: emptyBuckets(),
        })
      }
      const row = rows.get(key)
      const bucket = row.integrated[occurrence.cliMajor]
      let integrated = bucket.find(item => item.version === occurrence.version)
      if (!integrated) {
        integrated = {
          version: occurrence.version,
          production: false,
          locations: [],
          behindPublished: row.published
            ? semver.lt(occurrence.version, row.published.version) : null,
        }
        bucket.push(integrated)
      }
      integrated.production ||= occurrence.production
      integrated.locations.push(occurrence.location)
      if (!row.paths[occurrence.cliMajor].includes(occurrence.path)) {
        row.paths[occurrence.cliMajor].push(occurrence.path)
      }
    }
  }
  const sortedRows = [...rows.values()].sort((a, b) =>
    a.repository.localeCompare(b.repository) || a.package.localeCompare(b.package) ||
    b.packageMajor - a.packageMajor)
  for (const row of sortedRows) {
    for (const values of Object.values(row.integrated)) {
      values.sort((a, b) => semver.rcompare(a.version, b.version))
    }
  }
  const repositorySummary = [...repositories].map(([repository, repo]) => {
    const repoRows = sortedRows.filter(row => row.repository === repository)
    const branch = repo.branches.find(item => item.default)
    const root = repo.manifests.find(file =>
      file.branch.name === branch.name && file.file === 'package.json')
    return {
      repository,
      defaultBranch: branch.name,
      defaultVersion: root?.manifest?.version || null,
      defaultCommit: branch.commit,
      packages: [...new Set(repoRows.map(row => row.package))],
      neededExistingBranches: [...new Set(repoRows.map(row => row.branch).filter(Boolean))],
      missingPackageMajors: repoRows.filter(row => !row.branch).map(row => ({
        package: row.package, major: row.packageMajor, requiredBranch: row.requiredBranch,
      })),
      cli: Object.fromEntries(majors.map(major => [major,
        repoRows.filter(row => row.integrated[major].length).map(row => ({
          package: row.package,
          major: row.packageMajor,
          branch: row.branch,
          versions: row.integrated[major],
        })),
      ])),
    }
  }).sort((a, b) => a.repository.localeCompare(b.repository))
  const actual = sortedRows.flatMap(row => Object.values(row.integrated).flat())
    .reduce((sum, item) => sum + item.locations.length, 0)
  assert.equal(actual, records.reduce((sum, record) => sum + record.occurrences.length, 0))
  return {
    schemaVersion: 1,
    checkedAt,
    cli: lines.map(({ major, branch, version, commit, committedAt }) =>
      ({ major, branch, version, commit, committedAt })),
    latestStableByPackage: Object.fromEntries(records.map(record =>
      [record.name, versions.get(record.name).latestStable])),
    rows: sortedRows,
    repositorySummary,
    summary: {
      packages: records.length,
      repositories: repositorySummary.length,
      packageBranchRows: sortedRows.length,
      requiredExistingRepositoryBranches: repositorySummary.reduce((sum, repo) =>
        sum + repo.neededExistingBranches.length, 0),
      missingPackageMajorLines: sortedRows.filter(row => !row.branch).length,
      integrationCellsBehindPublished: sortedRows.reduce((sum, row) =>
        sum + Object.values(row.integrated).filter(values =>
          values.some(item => item.behindPublished)).length, 0),
    },
  }
}

export default async ({
  api, log = message => pLog.log.info('cli-deps', message), config = policy,
}) => {
  const checkedAt = new Date().toISOString()
  log('Pinning CLI refs and reading lockfiles and workspace manifests')
  const cliRefs = await api.getDependencyRefs(config.repository)
  const lines = await mapLimit(config.cli, async (configured) => {
    const ref = cliRefs.branches.find(branch => branch.name === configured.branch)
    assert(ref, `Missing configured CLI branch ${configured.branch}`)
    const files = await api.getDependencyFiles(config.repository, ref.commit,
      ['package.json'])
    const manifest = files['package.json']
    const lock = await api.getDependencyLock(config.repository, ref.commit)
    assert(manifest && lock?.packages, `${configured.branch}: missing CLI inputs`)
    assert.equal(semver.major(manifest.version), configured.major,
      `${configured.branch}: configured CLI major changed`)
    assert.equal(manifest.version, lock.version, `${configured.branch}: root lock version changed`)
    const paths = Object.keys(lock.packages).filter(location =>
      location && !location.includes('node_modules/'))
    const workspaces = await api.getDependencyFiles(config.repository, ref.commit,
      paths.map(location => `${location}/package.json`))
    for (const location of paths) {
      assert(workspaces[`${location}/package.json`],
        `${configured.branch}: missing workspace manifest ${location}`)
    }
    return {
      ...configured,
      commit: ref.commit,
      committedAt: ref.committedAt,
      version: manifest.version,
      manifest,
      lock,
      workspaces: paths.map(location =>
        ({ location, manifest: workspaces[`${location}/package.json`] })),
    }
  })
  const inventories = await mapLimit(lines, line =>
    readOccurrences(line, config.excludedTraversalPackage))
  const packages = new Map()
  for (const occurrence of inventories.flatMap(inventory => inventory.occurrences)) {
    if (!packages.has(occurrence.package)) {
      packages.set(occurrence.package, { name: occurrence.package, occurrences: [] })
    }
    packages.get(occurrence.package).occurrences.push(occurrence)
  }
  const records = [...packages.values()]
  log(`Resolving canonical repository ownership for ${records.length} packages`)
  await mapLimit(records, async (record) => {
    const occurrence = [...record.occurrences]
      .sort((a, b) => semver.rcompare(a.version, b.version))[0]
    const manifest = occurrence.workspace?.manifest ||
      await api.dependencyManifest(record.name, occurrence.version)
    record.declaration = repositoryName(manifest.repository)
  })
  const resolved = new Map()
  const resolveRepositories = async (names) => {
    await mapLimit(batches([...new Set(names)].filter(Boolean), 25), async (batch) => {
      const result = await api.getDependencyRepositories(batch)
      batch.forEach((name, index) => resolved.set(name, result[index]))
    })
  }
  await resolveRepositories(records.map(record => record.declaration))
  const fallback = records.filter(record => !resolved.get(record.declaration))
  await mapLimit(fallback, async (record) => {
    const manifest = await api.dependencyManifest(record.name, 'latest')
    record.declaration = repositoryName(manifest.repository)
  })
  await resolveRepositories(fallback.map(record => record.declaration)
    .filter(name => !resolved.has(name)))
  const unattributed = []
  for (const record of records) {
    const repository = resolved.get(record.declaration)?.nameWithOwner
    if (!repository) {
      assert(!record.declaration?.toLowerCase().startsWith(`${config.owner}/`),
        `Cannot verify npm repository ${record.declaration}`)
      unattributed.push({ package: record.name, repository: record.declaration })
    }
    record.repository = repository
  }
  const owned = records.filter(record =>
    record.repository?.split('/')[0].toLowerCase() === config.owner.toLowerCase())
  assert(owned.length, 'No npm-owned dependencies were resolved')
  const versions = new Map(await mapLimit(owned, async (record) =>
    [record.name, await api.dependencyVersions(record.name,
      [...new Set(record.occurrences.map(item => item.version))])]))
  const names = [...new Set(owned.map(record => record.repository))]
  log(`Reading branch manifests for ${owned.length} packages in ${names.length} repositories`)
  const repositories = new Map(await mapLimit(names, async (repository) => {
    const refs = await api.getDependencyRefs(repository)
    const branches = refs.branches.filter(stableBranch).map(branch => {
      const pinned = repository === config.repository &&
        lines.find(line => line.branch === branch.name)
      return pinned ? { ...branch, commit: pinned.commit, committedAt: pinned.committedAt } : branch
    })
    const repoRecords = owned.filter(record => record.repository === repository)
    const paths = new Set(['package.json'])
    for (const record of repoRecords) {
      for (const occurrence of record.occurrences) {
        if (occurrence.workspace) {
          paths.add(`${occurrence.workspace.location}/package.json`)
        }
      }
      const info = versions.get(record.name)
      for (const item of [...info.integratedMetadata, info.latestStable].filter(Boolean)) {
        const directory = item.repository?.directory
        if (directory) {
          paths.add(`${directory.replace(/\\/g, '/')}/package.json`)
        }
      }
    }
    const manifests = []
    for (const branch of branches) {
      for (const batch of batches([...paths], 50)) {
        const files = await api.getDependencyFiles(repository, branch.commit, batch)
        manifests.push(...Object.entries(files).map(([file, manifest]) =>
          ({ branch, file, manifest })))
      }
    }
    assert(branches.some(branch => branch.default), `${repository}: missing default ref`)
    return [repository, { branches, manifests }]
  }))
  const result = makeMatrix({ records: owned, repositories, versions, lines, checkedAt })
  const requests = result.repositorySummary.flatMap(repo => {
    const branches = new Set([repo.defaultBranch, ...repo.neededExistingBranches])
    return [...branches].map(branch => ({
      repository: repo.repository,
      branch,
      commit: branch === repo.defaultBranch ? repo.defaultCommit
      : result.rows.find(row => row.repository === repo.repository && row.branch === branch)
        .branchCommit,
    }))
  })
  log(`Collecting checks for ${requests.length} pinned branch commits`)
  const checks = (await mapLimit(batches(requests, 8), batch =>
    api.getDependencyChecks(batch))).flat()
  const analyzedAt = new Date().toISOString()
  return {
    ...result,
    analyzedAt,
    scope: {
      excludeTemplateOssOnlyTransitives: true,
      excludedTraversalPackage: config.excludedTraversalPackage,
      excludedOccurrences: inventories.reduce((sum, item) => sum + item.excludedOccurrences, 0),
      unattributed,
    },
    checks: {
      status: 'complete',
      checkedAt: analyzedAt,
      branches: Object.fromEntries(checks.map(check =>
        [`${check.repository}:${check.branch}`, { ...check, checkedAt: analyzedAt }])),
    },
  }
}
