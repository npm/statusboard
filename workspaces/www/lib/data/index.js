const path = require('path')

const getDate = (d) => {
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const year = d.getUTCFullYear().toString()
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}.json`
}

const dir = __dirname
const dailyDir = path.join(dir, 'daily')

module.exports = {
  dir,
  dailyDir,
  latest: path.join(dir, 'latest.json'),
  maintained: path.join(dir, 'maintained.json'),
  metadata: path.join(dir, 'metadata.json'),
  daily: (d) => path.join(dailyDir, getDate(d)),
}
