const logger = (level, ...args) => {
  if (level !== 'http') {
    console.error(level, ...args)
  }
}

module.exports = () => {
  process.on('log', logger)
  return () => process.off('log', logger)
}
