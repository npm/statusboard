export default {
  repository: 'npm/cli',
  owner: 'npm',
  excludedTraversalPackage: '@npmcli/template-oss',
  cli: [
    { major: 12, branch: 'latest' },
    { major: 11, branch: 'release/v11' },
    { major: 10, branch: 'release/v10' },
  ],
}
