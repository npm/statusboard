import pacote from 'pacote'
import pLog from 'proc-log'

export default {
  manifest: (spec, opt) => {
    pLog.log.verbose(`api:package:manifest`, spec)
    return pacote.manifest(spec, opt).catch(() => null)
  },
  packument: (spec, opt) => {
    pLog.log.verbose(`api:package:packument`, spec)
    return pacote.packument(spec, opt).catch(() => null)
  },
  downloads: (name) => {
    pLog.log.verbose(`api:package:downloads`, name)
    return fetch(`https://api.npmjs.org/downloads/point/last-month/${name}`)
      .then((res) => res.ok ? res.json() : null)
      .catch(() => null)
  },
}
