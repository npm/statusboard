const timers = require('timers/promises')

module.exports = async (promises, { delay } = {}) => {
  const wait = () => delay ? timers.setTimeout(delay) : Promise.resolve()

  const result = []

  const isObj = typeof promises === 'object' && !Array.isArray(promises)
  const promisesArr = isObj ? Object.entries(promises) : promises

  for (const p of promisesArr) {
    if (isObj) {
      const [key, value] = p
      if (typeof value === 'function') {
        result.push(await value().then(v => [key, v]))
        await wait()
      } else {
        result.push([key, null])
      }
    } else {
      result.push(await p())
      await wait()
    }
  }

  return isObj ? Object.fromEntries(result) : result
}
