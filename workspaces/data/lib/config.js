require('dotenv').config()

const { parseArgs } = require('util')
const { re, src, tokens } = require('semver')
const getVersion = (str = '') => str.match(re[tokens.FULLPLAIN])?.[0]

// workspace releases include a context between the word release and the version
const isRootRelease = (str = '') => str.match(new RegExp(`: release ${src[tokens.FULLPLAIN]}$`))

const {
  // add a delay between requests in CI since the built in GH tokens
  // on actions seem to be more susceptible to secondary rate limits
  delay = process.env.CI ? 1000 : 0,
  repoQuery = process.env.REPOSITORIES_QUERY,
  issueAndPrQuery = process.env.ISSUES_QUERY,
  noWrite = false,
} = parseArgs({
  options: {
    delay: {
      type: 'string',
    },
    repoQuery: {
      type: 'string',
    },
    issueAndPrQuery: {
      type: 'string',
    },
    noWrite: {
      type: 'boolean',
    },
  },
}).values

module.exports = {
  auth: process.env.AUTH_TOKEN,
  delay: +delay,
  write: !noWrite,
  repoQuery,
  issueAndPrQuery,
  // Return null to fallback to other filters
  repoFilter: (p) => p.repo.name === 'node' ? false : null,
  discussionQuery: 'answerChosenAt',
  discussionFilter: {
    unanswered: {
      filter: (discussion) => !!discussion.answerChosenAt,
      url: 'is:unanswered',
    },
  },
  issueFilter: {
    unlabeled: {
      filter: (issue) => issue.labels.length === 0,
      url: 'no:label',
    },
    goodFirstIssue: {
      filter: (issue) =>
        issue.labels.some(l => l.name === 'good-first-issue' || l.name === 'good first issue'),
      url: 'label:"good-first-issue","good first issue"',
    },
  },
  prFilter: {
    release: {
      find: (issue) => {
        const match = issue.labels.some(l => l.name === 'autorelease: pending') &&
          // only include root releases for now
          // TODO: workspace issue and pr management/filtering
          isRootRelease(issue.title)
        return match && {
          url: issue.html_url,
          version: getVersion(issue.title) || issue.title,
        }
      },
    },
  },
}
