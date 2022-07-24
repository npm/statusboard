const Range = require('semver/classes/range')

module.exports = (pkg) => {
  // Note: this only works for tap
  if (pkg?.devDependencies?.tap) {
    // Check if it is a version of tap that defaults to full coverage
    const hasDefaultCoverage = new Range(pkg.devDependencies.tap)
      .set[0][0].semver.major >= 15
    const tapConfig = pkg.tap || {}
    const limitKeys = ['branches', 'statements', 'functions', 'lines']

    // Check if any tap config is set that would disable coverage checking
    const coverageOffExplicitly =
      tapConfig['check-coverage'] === false ||
      tapConfig['no-check-coverage'] === true ||
      tapConfig.coverage === false ||
      tapConfig['no-coverage'] === true

    // Check if any tap configs are set that would enable full 100 coverage
    const fullCoverageOnExplicitly =
      tapConfig['100'] === true ||
      limitKeys.every((key) => +tapConfig[key] === 100)

    // Check if any tap config is set that would set a limit on coverage
    const hasPartialCoverage = limitKeys.some((key) => Object.hasOwn(tapConfig, key))

    const hasFullCoverage = (hasDefaultCoverage && !coverageOffExplicitly && !hasPartialCoverage) ||
      fullCoverageOnExplicitly

    if (hasFullCoverage) {
      return 100
    }

    if (hasPartialCoverage) {
      return Math.floor(limitKeys.reduce((acc, key) => {
        const limit = Object.hasOwn(tapConfig, key) ? +tapConfig[key] : hasDefaultCoverage ? 100 : 0
        return acc + limit
      }, 0) / limitKeys.length)
    }

    // We tried our best but there are a lot of ways to specify
    // options in tap and this doesn't account for everything.
    // But we return 0 so at least the statusboard will light up
    // red and we can go confirm it.
    return 0
  }
}
