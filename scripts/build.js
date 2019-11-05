const fs = require('fs')
const path = require('path')
const repos = require('../data/latest')
const Handlebars = require('handlebars')
const source = fs.readFileSync(path.resolve(__dirname, 'template.hbs'), 'utf8')
const template = Handlebars.compile(source)
const contents = template({ repos: repos })
fs.writeFile(path.resolve(__dirname, '../index.html'), contents, 'utf8', (err) => {
  if (err) throw err
  console.log(`Build complete!`)
})

