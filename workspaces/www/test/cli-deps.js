const t = require('node:test')
const a = require('node:assert/strict')
const model = import('../lib/js/cli-deps-model.mjs')

t.test('version indicators distinguish missing, mixed, and unavailable evidence', async () => {
  const { compareVersions } = await model
  const requirement = { target: '2.1.0', versions: ['2.0.0'] }
  a.equal(compareVersions([requirement], 'line').state, 'missing')
  const mixed = { ...requirement, versions: ['2.0.0', '2.1.0'] }
  a.equal(compareVersions([mixed], 'line').state, 'mixed')
  a.equal(compareVersions([mixed], 'overall').state, 'integrated')
  a.equal(compareVersions([{ ...mixed, target: null }], 'line').state, 'unknown')
  a.equal(compareVersions([{ ...requirement, versions: ['2.1.0'] }], 'line').state, 'integrated')
})

t.test('workspace comparisons use the selected CLI branch, not just package and major', async () => {
  const { requiredLines } = await model
  const rows = ['latest', 'release/v10'].map(branch => ({
    package: '@npmcli/config', packageMajor: 1, branch, branchCommit: branch,
  }))
  const repo = {
    repository: 'npm/cli',
    cli: { 10: [{
      package: '@npmcli/config',
      major: 1,
      branch: 'release/v10',
      versions: [{ production: true }],
    }] },
  }
  const lines = requiredLines(repo, 10, rows)
  a.equal(lines.length, 1)
  a.equal(lines[0].commit, 'release/v10')
  a.equal(lines[0].comparisons[0], rows[1])
})

t.test('check indicators never report absent or malformed results as passing', async () => {
  const { checkState } = await model
  const result = (state, run = 'SUCCESS') => ({
    commit: 'sha',
    rollup: {
      state,
      contexts: {
        totalCount: 1,
        checkRunCountsByState: [{ state: run, count: 1 }],
        statusContextCountsByState: [],
      },
    },
  })
  a.equal(checkState(undefined, 'sha').state, 'not-collected')
  a.equal(checkState({ commit: 'sha', rollup: null }, 'sha').state, 'no-checks')
  a.equal(checkState({ commit: 'other', rollup: null }, 'sha').state, 'unavailable')
  a.equal(checkState({ commit: 'sha' }, 'sha').state, 'unavailable')
  a.equal(checkState({ commit: 'sha', rollup: {} }, 'sha').state, 'unavailable')
  a.equal(checkState({ commit: 'sha', error: 'failed' }, 'sha').state, 'unavailable')
  a.equal(checkState(result('SUCCESS'), 'sha').state, 'passing')
  a.equal(checkState(result('FAILURE'), 'sha').state, 'failing')
  a.equal(checkState(result('PENDING', 'IN_PROGRESS'), 'sha').state, 'running')
  a.equal(checkState(result('PENDING', 'QUEUED'), 'sha').state, 'pending')
  a.equal(checkState(result('SUCCESS', 'SKIPPED'), 'sha').state, 'neutral')
})
