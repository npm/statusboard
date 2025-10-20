const t = require('node:test')
const a = require('node:assert')
const { spawnSync } = require('child_process')

t.test('can build', async () => {
  const res = spawnSync('npm', ['run', 'build', '--', '--prod'])
  a.equal(res.status, 0, 'build exits cleanly')
})
