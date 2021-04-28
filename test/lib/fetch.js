const { test } = require('tap')
const mockJoiEnvData = require('../../mock/joi-env-data.json')
const mockJoiEnvResponse = require('../../mock/joi-env-response.json')
const { mapToResponse } = require('../../lib/fetch')

test('map to response format', (t) => {
  t.plan(1)
  const data = mapToResponse('@npmcorp/joi-env', mockJoiEnvData)
  t.same(data, mockJoiEnvResponse, 'should map repo data into response schema')
  t.end()
})
