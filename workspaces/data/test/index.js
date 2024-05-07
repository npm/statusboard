import t from 'tap'
import fs from 'fs/promises'
import wwwPaths from 'www'

t.test('no missing data', async () => {
  const latest = await fs.readFile(wwwPaths.latest, 'utf-8').then(r => JSON.parse(r))
  const maintained = await fs.readFile(wwwPaths.maintained, 'utf-8').then(r => JSON.parse(r))

  t.equal(latest.length, maintained.length)
})
