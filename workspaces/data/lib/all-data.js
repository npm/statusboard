const path = require('path')
const fs = require('fs/promises')

module.exports = async ({ dir, filter = () => true }) => {
  const dirContents = await fs.readdir(dir).catch(() => [])
  const jsonFiles = dirContents.filter((f) => f.endsWith('.json') && filter(f))

  const jsonEntries = await Promise.all(
    jsonFiles.map(async (f) => {
      const data = await fs.readFile(path.join(dir, f), 'utf-8')
      return [path.basename(f), JSON.parse(data)]
    })
  )

  return jsonEntries.sort((a, b) => a[0].localeCompare(b[0]))
}
