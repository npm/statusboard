module.exports = function isJSON (response) {
  return response.ok && response.headers.get('content-type') === 'application/json'
}
