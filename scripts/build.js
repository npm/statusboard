const fs = require('fs')
const path = require('path')
const repos = require('../data/latest')
const Handlebars = require('handlebars')
const source = fs.readFileSync(path.resolve(__dirname, 'index.hbs'), 'utf8')
const template = Handlebars.compile(source)
const now = new Date()
const month = String('00' + (now.getUTCMonth()+1)).slice(-2)
const built = `${now.getUTCFullYear()}-${month}-${now.getUTCDate()}`
const contents = template({ repos, built })
fs.writeFile(path.resolve(__dirname, '../index.html'), contents, 'utf8', (err) => {
  if (err) throw err
  console.log(`Build complete!`)
})

