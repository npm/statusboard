const Rest = require('./rest.js')
const Graphql = require('./graphql.js')
const package = require('./package.js')
const cacheMethod = require('./cache.js')

module.exports = ({ auth }) => {
  const rest = Rest({ auth })
  const graphql = Graphql({ auth })
  const methods = Object.entries({
    ...rest,
    ...graphql,
    ...package,
  })
  return Object.fromEntries(methods.map(([k, v]) => [k, cacheMethod(v)]))
}
