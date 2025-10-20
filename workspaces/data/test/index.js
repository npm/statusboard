import fs from 'fs/promises'
import { default as t } from 'node:test'
import { default as a } from 'node:assert'
import wwwPaths from 'www'

t.test('no missing data', async () => {
  const latest = await fs.readFile(wwwPaths.latest, 'utf-8').then(r => JSON.parse(r))
  const maintained = await fs.readFile(wwwPaths.maintained, 'utf-8').then(r => JSON.parse(r))

  a.ok(latest.length)
  a.ok(maintained.length)
})
