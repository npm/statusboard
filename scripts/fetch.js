require('dotenv').config()

// const repositories = require('../public/data/maintained.json')

const repositories = [
  {
    name: 'cli',
    description: 'the package manager for JavaScript',
    repository: 'https://github.com/npm/cli',
    package: 'npm'
  }
]

const {
  getPullRequests,
  getRepo,
  getDeployments,
  getRepoIssues,
  getCoveralls,
  getPkgData,
  getDownloads,
  getNoLabelIssues
} = require('../api')
const { mapToResponse, writeFile } = require('../lib/fetch')

const exec = async () => {
  const latestJSON = '../public/data/latest.json'
  const now = new Date()
  const month = String('00' + (now.getUTCMonth() + 1)).slice(-2)
  const dest = `../public/data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const dir = dest.split('/').slice(0, -1).join('/')
  try {
    const promises = repositories.map(async (repo) => {
      try {
        const repoString = repo.repository.split('/').slice(-2)
        const owner = repoString[0]
        const name = repoString[1]

        const prs = getPullRequests(owner, name)
        const prCount = prs.length || 0

        const { data: repoData } = await getRepo(owner, name)

        const deployments = await getDeployments(
          owner,
          name,
          repoData.default_branch
        )

        const highPrioIssues = await getRepoIssues(owner, name, 'Priority 1')

        const needsTriageIssues = await getRepoIssues(
          owner,
          name,
          'Needs Triage'
        )

        let noLabelIssuesCount = await getNoLabelIssues(owner, name)
        noLabelIssuesCount = noLabelIssuesCount.length

        console.log(
          'Fetching coverage:',
          `https://coveralls.io/github/${owner}/${name}.json`
        )

        const coveralls = await getCoveralls(owner, name)

        const coverage = coveralls ? Math.round(coveralls.covered_percent) : ''

        let pkg = {}
        let downloads = {}
        let nodeVersion = ''

        if (repo.package) {
          console.log(
            'Fetching package data:',
            `https://unpkg.com/${repo.package}/package.json`
          )
          pkg = await getPkgData(repo.package)

          nodeVersion =
            pkg && pkg.engines && pkg.engines.node ? pkg.engines.node : null

          console.log(
            'Fetching downloads:',
            `https://api.npmjs.org/downloads/point/last-month/${repo.package}`
          )
          downloads = await getDownloads(repo.package)
        }

        const responseData = {
          repoData,
          owner,
          repo,
          prCount,
          coverage,
          name,
          nodeVersion,
          pkg,
          highPrioIssues,
          needsTriageIssues,
          noLabelIssuesCount,
          deployments,
          downloads
        }
        return mapToResponse(repo.package, responseData)
      } catch (error) {
        console.error(error)
      }
    })

    let result = await Promise.all(promises)
    result = {
      data: result.filter(r => !!r),
      created_at: new Date().toISOString()
    }

    writeFile(result, { dir, dest, latestJSON })
  } catch (error) {
    console.log(error)
  }
}

exec()
