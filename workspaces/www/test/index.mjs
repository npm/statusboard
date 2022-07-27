import t from 'tap'
import { spawnSync } from 'child_process'

t.test('can build', async () => {
  const res = spawnSync('npm', ['run', 'build', '--', '--prod'])
  t.equal(res.status, 0, 'build exits cleanly')
})
