const fs = require('fs/promises')
const wwwPaths = require('www')
const { basename } = require('path')
const getWorkflowId = require('./workflow-id.js')

const updateJson = async (file, key, newData) => {
  let currentData = {}
  try {
    currentData = JSON.parse(await fs.readFile(file, 'utf-8'))
  } catch {
    // no data
  }

  return fs.writeFile(file, JSON.stringify({
    ...currentData,
    [key]: {
      ...currentData[key],
      ...newData,
    },
  }, null, 2), 'utf-8')
}

module.exports = (filename) => {
  const date = new Date()
  return {
    date,
    save: async ({ status, ...data }) => {
      const newData = {
        ...data,
        id: getWorkflowId(),
      }
      if (status === 'success') {
        // on success, wipe any previous error
        // and save the date of the success
        newData.success = date
        newData.error = null
      } else {
        // on error, save the date of the error
        // but keep the success date around so
        // the frontend can display when that happened
        newData.error = date
      }
      await updateJson(wwwPaths.metadata, basename(filename, '.js'), newData)
    },
  }
}
