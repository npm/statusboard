const path = require('path')
const fs = require('fs/promises')

module.exports = async ({ projects, dir, filter }) => {
  const dirContents = await fs.readdir(dir).catch(() => [])
  const jsonFiles = dirContents.filter((f) => f.endsWith('.json') && filter(f))

  const jsonEntries = await Promise.all(
    jsonFiles.map(async (f) => {
      const data = await fs.readFile(path.join(dir, f), 'utf-8')
      return [path.basename(f, '.json'), JSON.parse(data)]
    })
  )
  const historyData = jsonEntries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((r) => r[1])

  const projectResults = projects.reduce((acc, project) => {
    acc[project.id] = []
    return acc
  }, {})

  for (const historicalProjects of historyData) {
    for (const project of historicalProjects.data) {
      if (Object.hasOwn(projectResults, project.id)) {
        projectResults[project.id].push(project)
      }
    }
  }

  return projectResults
}
