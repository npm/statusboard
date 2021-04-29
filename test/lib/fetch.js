const { test } = require('tap')
const mockJoiEnvData = require('../../mock/joi-env-data.json')
const mockJoiEnvResponse = require('../../mock/joi-env-response.json')
const { mapToResponse, writeFile } = require('../../lib/fetch')
const path = require('path')

test('map to response format', (t) => {
  t.plan(1)
  const data = mapToResponse('@npmcorp/joi-env', mockJoiEnvData)
  t.same(data, mockJoiEnvResponse, 'should map repo data into response schema')
  t.end()
})

test('write file', (t) => {
  t.plan(2)
  const testDir = t.testdir({
    'foo.json': JSON.stringify([]),
    'latest.json': JSON.stringify({ data: [], created_at: 'some_time' })
  })
  const contents = {
    data: [{ foo: 'bar' }],
    created_at: 'some_time'
  }
  writeFile(contents, {
    dir: `${testDir}`,
    dest: `${testDir}/foo.json`,
    latestJSON: `${testDir}/latest.json`
  })
  const dir = path.resolve(__dirname, testDir)
  const dest = require(`${dir}/foo.json`)
  const latest = require(`${dir}/latest.json`)

  t.match(dest, [], 'should write data to destination')
  t.match(
    latest,
    { data: [], created_at: 'some_time' },
    'should have data and created metadata'
  )
  t.end()
})

test('write file error', async (t) => {
  t.plan(1)
  t.throws(function () {
    writeFile({}, { dir: null, dest: null, latestJSON: null })
  }, 'should throw error')
  t.end()
})
