const projects = require('../data/maintained.json')
projects.forEach(p => console.log(p.name))
console.log(projects.length)