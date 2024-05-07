import Rest from './rest.js'
import Graphql from './graphql.js'
import pkg from './package.js'
import cacheMethod from './cache.js'

export default ({ auth, delay }) => {
  const rest = Rest({ auth })
  const graphql = Graphql({ auth })
  const methods = Object.entries({
    ...rest,
    ...graphql,
    ...pkg,
  })
  const cachedMethods = methods
    .map(([k, v]) => [k, cacheMethod(v, { delay })])
  return Object.fromEntries(cachedMethods)
}
