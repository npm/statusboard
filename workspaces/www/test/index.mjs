import { default as t } from 'node:test'
import { default as a } from 'node:assert'
import { spawnSync } from 'child_process'

t.test('can build', async () => {
  const res = spawnSync('npm', ['run', 'build', '--', '--prod'])
  a.equal(res.status, 0, 'build exits cleanly')
})
