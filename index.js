const fs = require('fs')
const repos = require('./repositories')
const Handlebars = require('handlebars')
const source = fs.readFileSync('./template.hbs', 'utf8')
const file = 'index.html'
const template = Handlebars.compile(source)

console.log(repos.packages.length)
fs.writeFile(file, template({ repos: repos.packages }), 'utf8', (err) => {
  if (err) throw err
  console.log(`${file} was created!`)
})
