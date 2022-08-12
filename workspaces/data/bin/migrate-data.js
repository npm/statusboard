const path = require('path')
const fs = require('fs/promises')
const log = require('proc-log')
const logger = require('../lib/logger.js')
const getAllData = require('../lib/all-data.js')
const wwwPaths = require('www')

logger()

const main = async ({ migrate }) => {
  const dir = wwwPaths.dailyDir

  const migrateData = (data) =>
    JSON.stringify(data.map(migrate), null, 2)

  const allData = await getAllData({ dir })

  for (const [name, data] of allData) {
    await fs.writeFile(path.join(dir, name), migrateData(data))
  }

  await fs.writeFile(wwwPaths.latest, migrateData(require(wwwPaths.latest)))

  return 'Done'
}

// Write your one off migration here
const migrations = {
  '2022-07-28T18:34:09': (data) => {
    const { pendingRelease } = data
    delete data.pendingRelease
    if (data.prs) {
      data.prs.release = pendingRelease
    }
    return data
  },
  '2022-07-28T18:48:54': (data) => {
    if (data.prs?.release) {
      // https://api.github.com/repos/npm/config/issues/73
      // ---> https://github.com/npm/config/pull/73
      const url = new URL(data.prs.release.url)
      url.hostname = 'github.com'
      url.pathname = url.pathname.replace('/repos/', '').replace('/issues/', '/pull/')
      data.prs.release.url = url.toString()
    }
    return data
  },
  '2022-07-28T14:20:50': (data) => {
    if (data.issues?.noLabel) {
      data.issues.unlabeled = data.issues.noLabel
      delete data.issues.noLabel
    }
    return data
  },
}

main({
  migrate: migrations[process.argv[2]],
})
  .then(console.log)
  .catch(err => {
    log.error(err)
    process.exitCode = 1
  })
