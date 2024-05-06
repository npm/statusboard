module.exports = {
  rootRepo: {
    add: {
      '.github/settings.yml': 'settings-yml.hbs',
      '.github/dependabot.yml': 'dependabot-yml.hbs',
    },
  },
  workspaceRepo: {
    add: {
      '.github/settings.yml': 'settings-yml.hbs',
      '.github/dependabot.yml': false,
    },
  },
  ciVersions: 'latest',
  windowsCI: false,
  macCI: false,
  lockfile: true,
}
