module.exports = async (promises) => {
  const entries = Object.entries(promises)
  const res = await Promise.all(entries.map(([key, value]) => {
    if (typeof value === 'function') {
      return value().then(v => [key, v])
    }
    return [key, null]
  }))
  return Object.fromEntries(res)
}
