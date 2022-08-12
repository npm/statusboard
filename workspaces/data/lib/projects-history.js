const getAllData = require('./all-data.js')

module.exports = async ({ projects, dir, filter }) => {
  const historyData = await getAllData({ dir, filter })
    .then(data => data.map(r => r[1]))

  const projectResults = projects.reduce((acc, project) => {
    acc[project.id] = []
    return acc
  }, {})

  for (const historicalProjects of historyData) {
    for (const project of historicalProjects) {
      if (Object.hasOwn(projectResults, project.id)) {
        projectResults[project.id].push(project)
      }
    }
  }

  return projectResults
}
