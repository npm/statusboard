module.exports = () => {
  process.on('log', (level, ...args) => level !== 'http' && console.error(level, ...args))
  return () => process.off('log')
}
