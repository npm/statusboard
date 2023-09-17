module.exports = {
  rootModule: {
    add: {
      'package.json': {
        file: './pkg.json',
        overwrite: false,
      },
    },
  },
  workspaceModule: {
    add: {
      'package.json': {
        file: './pkg.json',
        overwrite: false,
      },
    },
  },
  ciVersions: 'latest',
  windowsCI: false,
  macCI: false,
  lockfile: true,
}
