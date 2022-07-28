// A memory cache for expensive requests like check-runs
// which can get called for the same commit multiple times
// in workspaces. Also used if we retry the whole thing
// again during the same process
const CACHE = new Map()

const cacheMethod = (fn) => {
  CACHE.set(fn, new Map())

  return async (...args) => {
    const key = args.map(JSON.stringify).join('--')

    if (CACHE.get(fn).has(key)) {
      return CACHE.get(fn).get(key)
    }

    const res = await fn(...args)
    CACHE.get(fn).set(key, res)

    return res
  }
}

module.exports = cacheMethod
