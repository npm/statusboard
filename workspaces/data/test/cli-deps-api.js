import t from 'node:test'
import a from 'node:assert/strict'
import api from '../lib/api/cli-deps.js'

t('ownership lookup preserves known missing repos but propagates permission failures', async () => {
  const known = { nameWithOwner: 'npm/example' }
  const partial = Object.assign(new Error('not found'), {
    data: { r0: known, r1: null }, errors: [{ type: 'NOT_FOUND' }],
  })
  const client = api(async () => {
    throw partial
  })
  a.deepEqual(await client.getDependencyRepositories(['npm/example', 'old/missing']), [known, null])
  const denied = Object.assign(new Error('forbidden'), {
    data: { r0: null }, errors: [{ type: 'FORBIDDEN' }],
  })
  await a.rejects(api(async () => {
    throw denied
  }).getDependencyRepositories(['npm/example']),
  /forbidden/)
})

t('pinned file reads distinguish missing files from missing commits and invalid JSON', async () => {
  const client = response => api(async () => response)
  a.deepEqual(await client({
    repository: { commit: { oid: 'sha' }, f0: null },
  }).getDependencyFiles('npm/example', 'sha', ['package.json']), { 'package.json': null })
  await a.rejects(client({
    repository: { commit: null, f0: null },
  }).getDependencyFiles('npm/example', 'sha', ['package.json']), /Missing commit/)
  await a.rejects(client({
    repository: { commit: { oid: 'sha' }, f0: { text: '{"truncated":' } },
  }).getDependencyFiles('npm/example', 'sha', ['package.json']), SyntaxError)
})

t('check reads require the exact pinned commit', async () => {
  const request = { repository: 'npm/example', branch: 'main', commit: 'sha' }
  await a.rejects(api(async () => ({
    r0: { object: { oid: 'other', statusCheckRollup: null } },
  })).getDependencyChecks([request]), /could not read/)
  const checks = await api(async () => ({
    r0: { object: { oid: 'sha', statusCheckRollup: null } },
  })).getDependencyChecks([request])
  a.equal(checks[0].rollup, null)
})
