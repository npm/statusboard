const path = require('path')
const fs = require('fs/promises')

module.exports = async (files, data) => {
  return Promise.all(files.map(async (fileOpts) => {
    const { path: filePath, indent = 0 } = typeof fileOpts === 'string'
      ? { path: fileOpts } : fileOpts
    const relPath = path.relative(process.cwd(), filePath)

    await fs.mkdir(path.dirname(filePath), { recursive: true })

    const contents = JSON.stringify(data, null, indent)
    await fs.writeFile(filePath, contents, 'utf-8')

    return {
      path: filePath,
      relPath,
      contents,
      message: `Wrote ${Buffer.byteLength(contents, 'utf-8')} bytes to ${relPath}`,
    }
  }))
}
