const { parseArgs } = require('util')
const { re, tokens } = require('semver')
const getVersion = (str = '') => str.match(re[tokens.FULLPLAIN])?.[0]

const {
  delay = 1000,
  repoQuery = 'org:npm topic:npm-cli fork:true',
  issueAndPrQuery = 'is:open',
  repoFilter = null,
} = parseArgs({
  args: process.argv.slice(2),
  options: {
    delay: {
      type: 'string',
    },
    repoQuery: {
      type: 'string',
    },
    repoFilter: {
      type: 'string',
    },
    issueAndPrQuery: {
      type: 'string',
    },
  },
}).values

module.exports = {
  auth: process.env.AUTH_TOKEN,
  delay: +delay,
  repoQuery,
  repoFilter,
  issueAndPrQuery,
  issueFilter: {
    unlabeled: {
      filter: (issue) => issue.labels.length === 0,
      url: 'no:label',
    },
    priority: {
      filter: (issue) => issue.labels.some(l => l.name === 'Priority 1' || l.name === 'Priority 0'),
      url: 'label:"Priority 1","Priority 0',
    },
    triage: {
      filter: (issue) => issue.labels.some(l => l.name === 'Needs Triage'),
      url: 'label:"Needs Triage"',
    },
  },
  prFilter: {
    release: {
      find: (issue) => {
        const match = issue.labels.some(l => l.name === 'autorelease: pending')
        return match && {
          url: issue.html_url,
          version: getVersion(issue.title) || issue.title,
        }
      },
    },
  },
}
