require('dotenv').config()

const repositories = require('../public/data/maintained.json')

const api = require('../api')

const { mapToResponse, writeFile } = require('../lib/fetch')
const { sleep } = require('sleepover')

const exec = async () => {
  const latestJSON = '../public/data/latest.json'
  const now = new Date()
  const month = String('00' + (now.getUTCMonth() + 1)).slice(-2)
  const dest = `../public/data/${now.getUTCFullYear()}/${month}/${now.getUTCDate()}.json`
  const dir = dest.split('/').slice(0, -1).join('/')

  /**
   * We split up the iteration twice in order to compensate for having to use the `sleep` library.
   * The throttling plugin does not work for paginate calls that use the search api.
   */
  const repoIssuesMap = {}
  try {
    let completed = 0
    const total = repositories.length
    console.log(`Requesting issue data for ${total} repositories.`)
    for await (const r of repositories) {
      const repoString = r.repository.split('/').slice(-2)
      const owner = repoString[0]
      const name = repoString[1]
      const noLabelIssues = await api.getNoLabelIssues(owner, name)
      await sleep(500)
      const highPrioIssues = await api.getRepoIssues(owner, name, 'Priority 1')
      await sleep(250)
      const needsTriageIssues = await api.getRepoIssues(
        owner,
        name,
        'Needs Triage'
      )
      repoIssuesMap[`${owner}/${name}`] = {
        noLabelIssuesCount: noLabelIssues.length,
        highPrioIssuesCount: highPrioIssues.length,
        needsTriageIssuesCount: needsTriageIssues.length
      }
      completed++
      console.log(`completed: ${completed} / ${total}`)
    }
  } catch (error) {
    console.log(error)
  }

  try {
    const promises = repositories.map(async (repo) => {
      try {
        const repoString = repo.repository.split('/').slice(-2)
        const owner = repoString[0]
        const name = repoString[1]

        const prs = await api.getPullRequests(owner, name)
        const prCount = prs.length || 0

        const { data: repoData } = await api.getRepo(owner, name)

        const checkRuns = await api.getCheckRuns(
          owner,
          name,
          repoData.default_branch
        )

        console.log(
          'Fetching coverage:',
          `https://coveralls.io/github/${owner}/${name}.json`
        )

        const coveralls = await api.getCoveralls(owner, name)

        const coverage = coveralls ? Math.round(coveralls.covered_percent) : ''

        let pkg = {}
        let packument = {}
        let downloads = {}
        let nodeVersion = ''
        let lastPublish = null

        if (repo.package) {
          console.log(`Fetching packument and manifest for ${repo.package}`)
          pkg = await api.getManifest(repo.package)
          packument = await api.getPackument(repo.package)

          nodeVersion =
            pkg && pkg.engines && pkg.engines.node || null

          lastPublish = packument && packument.modified || null

          console.log(
            'Fetching downloads:',
            `https://api.npmjs.org/downloads/point/last-month/${repo.package}`
          )
          downloads = await api.getDownloads(repo.package)
        }

        const {
          highPrioIssuesCount,
          needsTriageIssuesCount,
          noLabelIssuesCount
        } = repoIssuesMap[`${owner}/${name}`]

        const responseData = {
          repoData,
          owner,
          repo,
          prCount,
          coverage,
          name,
          nodeVersion,
          lastPublish,
          pkg,
          highPrioIssues: highPrioIssuesCount,
          needsTriageIssues: needsTriageIssuesCount,
          noLabelIssuesCount: noLabelIssuesCount,
          checkRuns,
        }

        return mapToResponse(repo.package, responseData)
      } catch (error) {
        console.error(error)
      }
    })

    let result = await Promise.all(promises)
    result = {
      data: result.filter((r) => !!r),
      created_at: new Date().toISOString()
    }

    writeFile(result, { dir, dest, latestJSON })
  } catch (error) {
    console.log(error)
  }
}

exec()
