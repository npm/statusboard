const pacote = require('pacote')
const log = require('proc-log')
const cacheMethod = require('./cache.js')

module.exports = {
  manifest: cacheMethod((spec, opt) => {
    log.verbose(`api:package:manifest`, spec)
    return pacote.manifest(spec, opt).catch(() => null)
  }),
  packument: cacheMethod((spec, opt) => {
    log.verbose(`api:package:packument`, spec)
    return pacote.packument(spec, opt).catch(() => null)
  }),
  downloads: cacheMethod((name) => {
    log.verbose(`api:package:downloads`, name)
    return fetch(`https://api.npmjs.org/downloads/point/last-month/${name}`)
      .then((res) => res.ok ? res.json() : null)
      .catch(() => null)
  }),
}
