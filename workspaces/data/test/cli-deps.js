import t from 'node:test'
import a from 'node:assert/strict'
import collect, { makeMatrix, readOccurrences, repositoryName } from '../lib/cli-deps.js'
import fs from 'node:fs/promises'
import updateMetadata from '../lib/update-metadata.js'

const snapshot = () => {
  const manifest = {
    name: 'npm',
    version: '12.0.0',
    workspaces: ['workspaces/*'],
    dependencies: { pacote: '20.0.0' },
    devDependencies: { '@npmcli/template-oss': '5.0.0', eslint: '1.0.0' },
  }
  const workspaces = [
    { location: 'workspaces/config',
      manifest: {
        name: '@npmcli/config',
        version: '12.0.0',
        devDependencies: { 'write-file-atomic': '3.0.0' },
      } },
    { location: 'workspaces/docs',
      manifest: {
        name: '@npmcli/docs',
        version: '1.0.0',
        private: true,
        devDependencies: { which: '2.0.0' },
      } },
  ]
  const packages = {
    '': manifest,
    'node_modules/pacote': { version: '20.0.0', dependencies: { bridge: '1.0.0' } },
    'node_modules/bridge': { version: '1.0.0', dependencies: { shared: '1.0.0' } },
    'node_modules/shared': { version: '1.0.0' },
    'node_modules/@npmcli/template-oss': {
      version: '5.0.0',
      dev: true,
      dependencies: { exclusive: '1.0.0', shared: '1.0.0', pacote: '21.0.0' },
    },
    'node_modules/@npmcli/template-oss/node_modules/pacote': { version: '21.0.0', dev: true },
    'node_modules/exclusive': { version: '1.0.0', dev: true },
    'node_modules/eslint': {
      version: '1.0.0', dev: true, dependencies: { semver: '6.0.0' },
    },
    'node_modules/semver': { version: '6.0.0', dev: true },
    'node_modules/write-file-atomic': { version: '3.0.0', dev: true },
    'node_modules/which': { version: '2.0.0', dev: true },
  }
  for (const workspace of workspaces) {
    packages[workspace.location] = workspace.manifest
    packages[`node_modules/${workspace.manifest.name}`] = {
      link: true, resolved: workspace.location,
    }
  }
  return {
    major: 12,
    branch: 'latest',
    manifest,
    workspaces,
    lock: { name: 'npm', version: '12.0.0', lockfileVersion: 3, packages },
  }
}

t('scope follows alternate paths and retains workspace test dependencies', async () => {
  const { occurrences } = await readOccurrences(snapshot(), '@npmcli/template-oss')
  const versions = occurrences.map(item => `${item.package}@${item.version}`)
  a(versions.includes('pacote@20.0.0'))
  a(!versions.includes('pacote@21.0.0'))
  a(!versions.includes('exclusive@1.0.0'))
  a(versions.includes('@npmcli/template-oss@5.0.0'))
  a(versions.includes('semver@6.0.0'))
  a(versions.includes('write-file-atomic@3.0.0'))
  a(versions.includes('which@2.0.0'))
  a(!versions.includes('@npmcli/docs@1.0.0'))
  const shared = occurrences.find(item => item.package === 'shared')
  a(shared.path.includes('bridge@1.0.0'))
  a(!shared.path.includes('template-oss'))
  a.equal(shared.production, true)
  a.equal(occurrences.find(item => item.package === 'which').production, false)
})

t('scope refuses to discard a runtime dependency', async () => {
  const line = snapshot()
  line.lock.packages['node_modules/exclusive'].dev = false
  await a.rejects(readOccurrences(line, '@npmcli/template-oss'),
    /exclusion would remove runtime dependency/)
})

t('branches match manifest majors; multiple majors and version baselines remain distinct', () => {
  const branches = [
    { name: 'main', commit: 'head', default: true, version: '22.2.0' },
    { name: 'release/v99', commit: 'maintenance', version: '20.5.0' },
    { name: 'release/v19', commit: 'wrong-major', version: '18.0.0' },
    { name: 'release-v19.0.1', commit: 'preparation', version: '19.0.1' },
  ]
  const records = [{
    name: 'pacote',
    repository: 'npm/pacote',
    occurrences: [
      { cliMajor: 10,
        cliBranch: 'release/v10',
        version: '19.0.0',
        location: 'old',
        production: true,
        path: 'old path' },
      { cliMajor: 10,
        cliBranch: 'release/v10',
        version: '20.0.1',
        location: 'new',
        production: true,
        path: 'new path' },
      { cliMajor: 12,
        cliBranch: 'latest',
        version: '22.0.0',
        location: 'latest',
        production: true,
        path: 'latest path' },
    ],
  }]
  const versions = new Map([['pacote', {
    majors: { 19: { version: '19.0.1' }, 20: { version: '20.0.1' }, 22: { version: '22.0.1' } },
    latestStable: { version: '23.0.0' },
  }]])
  const result = makeMatrix({
    records,
    versions,
    checkedAt: '2026-11-09T00:00:00Z',
    lines: [{ major: 12, branch: 'latest' }, { major: 10, branch: 'release/v10' }],
    repositories: new Map([['npm/pacote', {
      branches,
      manifests: branches.map(branch => ({
        branch,
        file: 'package.json',
        manifest: { name: 'pacote', version: branch.version },
      })),
    }]]),
  })
  const row = major => result.rows.find(item => item.packageMajor === major)
  a.equal(row(20).branch, 'release/v99')
  a.equal(row(19).branch, null)
  a.equal(row(19).requiredBranch, 'release/v19')
  a.deepEqual(result.repositorySummary[0].cli[10].map(item => item.major), [20, 19])
  a.equal(row(22).branchCurrentVersion, '22.2.0')
  a.equal(row(22).published.version, '22.0.1')
  a.equal(row(22).integrated[12][0].version, '22.0.0')
  a.equal(row(22).integrated[12][0].behindPublished, true)
  a.equal(result.latestStableByPackage.pacote.version, '23.0.0')
})

t('workspace packages map to their own CLI branch even when package majors match', () => {
  const branches = [
    { name: 'latest', commit: 'latest', default: true },
    { name: 'release/v10', commit: 'older' },
  ]
  const result = makeMatrix({
    checkedAt: '2026-11-09T00:00:00Z',
    lines: [{ major: 12 }, { major: 10 }],
    records: [{
      name: '@npmcli/config',
      repository: 'npm/cli',
      occurrences: branches.map((branch, index) => ({
        version: '1.0.0',
        cliBranch: branch.name,
        cliMajor: index ? 10 : 12,
        location: 'workspaces/config',
        production: true,
        path: branch.name,
      })),
    }],
    versions: new Map([['@npmcli/config', {
      majors: { 1: { version: '1.0.0' } }, latestStable: { version: '1.0.0' },
    }]]),
    repositories: new Map([['npm/cli', {
      branches,
      manifests: branches.map(branch => ({
        branch,
        file: 'workspaces/config/package.json',
        manifest: { name: '@npmcli/config', version: '1.0.0' },
      })),
    }]]),
  })
  a.equal(result.rows.length, 2)
  a.equal(result.repositorySummary[0].cli[10][0].branch, 'release/v10')
  a.equal(result.repositorySummary[0].cli[12][0].branch, 'latest')
})

t('repository declarations only resolve GitHub repository URLs and shortcuts', () => {
  a.equal(repositoryName({ url: 'git+https://github.com/npm/pacote.git' }), 'npm/pacote')
  a.equal(repositoryName('git@github.com:npm/pacote.git'), 'npm/pacote')
  a.equal(repositoryName('github:npm/pacote'), 'npm/pacote')
  a.equal(repositoryName('npm/pacote'), 'npm/pacote')
  a.equal(repositoryName('https://github.com/npm/cli/tree/latest/workspaces/config'), 'npm/cli')
  a.equal(repositoryName('https://notgithub.com/npm/pacote'), null)
  a.equal(repositoryName(undefined), null)
})

t('a moving CLI ref must still match its configured major', async () => {
  const api = {
    getDependencyRefs: async () => ({ branches: [{ name: 'latest', commit: 'sha' }] }),
    getDependencyFiles: async () => ({ 'package.json': { name: 'npm', version: '13.0.0' } }),
    getDependencyLock: async () => ({ version: '13.0.0', packages: {} }),
  }
  await a.rejects(collect({
    api,
    log: () => {},
    config: { repository: 'npm/cli', cli: [{ major: 12, branch: 'latest' }] },
  }), /configured CLI major changed/)
})

t('failed CLI refresh keeps its last success and unrelated project metadata', async context => {
  let contents = {
    'fetch-data': { success: '2026-11-08T00:00:00Z' },
    'fetch-cli-deps': { success: '2026-11-07T00:00:00Z', error: null },
  }
  context.mock.method(fs, 'readFile', async () => JSON.stringify(contents))
  context.mock.method(fs, 'writeFile', async (file, value) => {
    contents = JSON.parse(value)
  })
  const metadata = updateMetadata('fetch-cli-deps.js')
  await metadata.save({ status: 'error', message: 'Network failure' })
  a.equal(contents['fetch-cli-deps'].success, '2026-11-07T00:00:00Z')
  a.equal(contents['fetch-cli-deps'].message, 'Network failure')
  a(contents['fetch-cli-deps'].error)
  a.equal(contents['fetch-data'].success, '2026-11-08T00:00:00Z')
  await metadata.save({ status: 'success', message: null })
  a.equal(contents['fetch-cli-deps'].error, null)
  a.notEqual(contents['fetch-cli-deps'].success, '2026-11-07T00:00:00Z')
})
