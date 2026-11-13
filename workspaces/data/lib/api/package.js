import pacote from 'pacote'
import pLog from 'proc-log'
import semver from 'semver'

export default {
  dependencyManifest: (name, version) =>
    pacote.manifest(`${name}@${version}`, { fullMetadata: true }),
  dependencyVersions: async (name, integrated) => {
    const document = await pacote.packument(name, { fullMetadata: true })
    const versions = Object.keys(document.versions)
      .filter(version => semver.valid(version) && !semver.prerelease(version))
      .sort(semver.compare)
    const metadata = version => ({
      version,
      repository: document.versions[version].repository,
      publishedAt: document.time?.[version],
    })
    return {
      checkedAt: new Date().toISOString(),
      majors: Object.fromEntries(versions.map(version =>
        [semver.major(version), metadata(version)])),
      latestStable: versions.length ? metadata(versions.at(-1)) : null,
      integratedMetadata: integrated.filter(version => document.versions[version])
        .map(metadata),
    }
  },
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
