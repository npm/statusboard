const fs = require('fs')
const repos = require('./dump')
const copyfiles = require('copyfiles')
const Handlebars = require('handlebars')
const source = fs.readFileSync('./template.hbs', 'utf8')
const file = './index.html'
const template = Handlebars.compile(source)

copyfiles(['./src/*.js', './src/*.css', './dist/'], (err) => {
  if (err) throw err
  console.log('files copied!')
})

fs.writeFile(file, template({ repos: repos.filter(r => !r.isArchived) }), 'utf8', (err) => {
  if (err) throw err
  console.log(`${file} was created!`)
})

