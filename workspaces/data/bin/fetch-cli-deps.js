import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import wwwPaths from 'www'
import Api from '../lib/api/index.js'
import config from '../lib/config.js'
import collect from '../lib/cli-deps.js'
import logger from '../lib/logger.js'
import writeJson from '../lib/write-json.js'
import updateMetadata from '../lib/update-metadata.js'

logger()
const metadata = updateMetadata(fileURLToPath(import.meta.url))
const temporary = `${wwwPaths.cliDeps}.${process.pid}.tmp`

try {
  const result = await collect({ api: Api(config) })
  if (config.write) {
    try {
      await writeJson([{ path: temporary, indent: 2 }], result)
      await fs.rename(temporary, wwwPaths.cliDeps)
    } finally {
      await fs.rm(temporary, { force: true })
    }
    await metadata.save({ status: 'success', message: null })
    console.log(`Collected ${result.summary.packages} packages in ${result.summary.repositories} repositories`)
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
} catch (error) {
  if (config.write) {
    await metadata.save({ status: 'error', message: error.message })
  }
  console.error(error.stack)
  process.exitCode = 1
}
