const fs = require('fs')
const { organization } = require('./dump')
const copyfiles = require('copyfiles')
const Handlebars = require('handlebars')
const source = fs.readFileSync('./template.hbs', 'utf8')
const file = './index.html'
const template = Handlebars.compile(source)

copyfiles(['./src/*.js', './src/*.css', './dist/'], (err) => {
  if (err) throw err
  console.log('files copied!')
})

const repos = organization.repositories.nodes.filter(r => !r.isArchived)
fs.writeFile(file, template({ repos }), 'utf8', (err) => {
  if (err) throw err
  console.log(`${file} was created!`)
})

