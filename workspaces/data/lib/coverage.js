const Range = require('semver/classes/range')

const floorAvg = (arr) => Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length)
const getMajor = (spec) => new Range(spec).set[0][0].semver.major

const tapMajorWith100 = 15
const limitKeys = ['branches', 'statements', 'functions', 'lines']
const coverageKeys = ['check-coverage', 'coverage'].reduce((acc, k) => {
  acc.push(k, `no-${k}`)
  return acc
}, [])

// Note: this only works for tap
module.exports = (pkg) => {
  const tapSpec = pkg.devDependencies?.tap

  if (!tapSpec) {
    return 0
  }

  const tapConfig = pkg.tap || {}

  // Check if it is a version of tap that defaults to full coverage
  const hasDefaultCoverage = getMajor(tapSpec) >= tapMajorWith100

  // Check if any tap config is set that would disable coverage checking
  const coverageOffExplicitly = coverageKeys.some((k) => {
    const isOffBool = k.startsWith('no-')
    return tapConfig[k] === isOffBool
  })

  // Check if any tap configs are set that would enable full 100 coverage
  const fullCoverageOnExplicitly =
      tapConfig['100'] === true ||
      limitKeys.every((key) => +tapConfig[key] === 100)

  // Check if any tap config is set that would set a limit on coverage
  const hasPartialCoverage =
      !fullCoverageOnExplicitly &&
      limitKeys.some((key) => Object.hasOwn(tapConfig, key))

  const hasFullCoverage =
      (hasDefaultCoverage && !coverageOffExplicitly && !hasPartialCoverage) ||
      fullCoverageOnExplicitly

  if (hasFullCoverage) {
    return 100
  }

  if (hasPartialCoverage) {
    return floorAvg(limitKeys.map((key) =>
      Object.hasOwn(tapConfig, key) ? +tapConfig[key] : hasDefaultCoverage ? 100 : 0
    ))
  }

  // We tried our best but there are a lot of ways to specify
  // options in tap and this doesn't account for everything.
  // But we return 0 so at least the statusboard will light up
  // red and we can go confirm it.
  // This should be a non-issue once template-oss is on everywhere.
  return 0
}
