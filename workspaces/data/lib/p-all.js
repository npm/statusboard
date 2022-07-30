module.exports = async (promises) => {
  const result = []

  const isObj = typeof promises === 'object' && !Array.isArray(promises)
  const promisesArr = isObj ? Object.entries(promises) : promises

  for (const p of promisesArr) {
    if (isObj) {
      const [key, value] = p
      if (typeof value === 'function') {
        result.push(await value().then(v => [key, v]))
      } else {
        result.push([key, null])
      }
    } else {
      result.push(await p())
    }
  }

  return isObj ? Object.fromEntries(result) : result
}
