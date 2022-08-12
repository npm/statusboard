const t = require('tap')
const wwwPaths = require('www')

const latest = require(wwwPaths.latest)
const maintained = require(wwwPaths.maintained)

t.test('no missing data', async () => {
  t.equal(latest.length, maintained.length)
})
