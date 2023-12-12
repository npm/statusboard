module.exports = {
  rootRepo: {
    add: {
      '.github/settings.yml': 'settings-yml.hbs',
    },
  },
  workspaceRepo: {
    add: {
      '.github/settings.yml': 'settings-yml.hbs',
    },
  },
  ciVersions: 'latest',
  windowsCI: false,
  macCI: false,
  lockfile: true,
}
