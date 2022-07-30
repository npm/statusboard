const Rest = require('./rest.js')
const Graphql = require('./graphql.js')
const package = require('./package.js')
const cacheMethod = require('./cache.js')

module.exports = ({ auth, delay }) => {
  const rest = Rest({ auth })
  const graphql = Graphql({ auth })
  const methods = Object.entries({
    ...rest,
    ...graphql,
    ...package,
  })
  const cachedMethods = methods
    .map(([k, v]) => [k, cacheMethod(v, { delay })])
  return Object.fromEntries(cachedMethods)
}
