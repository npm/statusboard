module.exports = async (promises) => {
  const result = []
  for (const [key, value] of Object.entries(promises)) {
    if (typeof value === 'function') {
      result.push(await value().then(v => [key, v]))
    } else {
      result.push([key, null])
    }
  }
  return Object.fromEntries(result)
}
