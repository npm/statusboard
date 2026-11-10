const t = require('node:test')
const a = require('node:assert')
const { spawnSync } = require('child_process')
const fs = require('node:fs/promises')
const path = require('node:path')

t.test('can build', async () => {
  const root = path.resolve(__dirname, '..')
  const res = spawnSync(process.execPath, [path.join(root, 'bin', 'build.mjs'), '--prod'], {
    cwd: root, encoding: 'utf8',
  })
  a.equal(res.status, 0, res.stderr)
  for (const page of ['index.html', 'cli-deps.html']) {
    const html = await fs.readFile(path.join(root, 'build', page), 'utf8')
    for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
      await fs.access(path.join(root, 'build', asset))
    }
  }
})
