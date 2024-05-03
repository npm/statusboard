const logger = (level, ...args) => {
  if (level !== 'http') {
    // eslint-disable-next-line no-console
    console.error(level, ...args)
  }
}

module.exports = () => {
  process.on('log', logger)
  return () => process.off('log', logger)
}
