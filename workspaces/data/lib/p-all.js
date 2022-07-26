const delay = (t = 1000) => new Promise(r => setTimeout(() => r(), t))

module.exports = async (promises, t) => {
  const result = []

  const isObj = typeof promises === 'object' && !Array.isArray(promises)
  const promisesArr = isObj ? Object.entries(promises) : promises

  for (const p of promisesArr) {
    if (isObj) {
      const [key, value] = p
      if (typeof value === 'function') {
        result.push(await value().then(v => [key, v]))
        await delay(t)
      } else {
        result.push([key, null])
      }
    } else {
      result.push(await p())
      await delay(t)
    }
  }

  return isObj ? Object.fromEntries(result) : result
}
