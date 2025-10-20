const t = require('node:test')
const a = require('node:assert')

t.test('tests are in workspaces', t => {
  a.ok(1, 'tests are in workspaces/*')
})
