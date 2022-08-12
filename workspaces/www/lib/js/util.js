import semverParse from 'semver/functions/parse'
import semverSubset from 'semver/ranges/subset'
import SemverRange from 'semver/classes/range'
import semverSort from 'semver/functions/rsort'
import { formatDistanceToNowStrict } from 'date-fns'

export const semver = {
  parse: semverParse,
  subset: semverSubset,
  score: (v) => {
    const p = semverParse(v)
    return p ? p.patch * 1 + p.minor * 1e3 + p.major * 1e6 : 0
  },
  rangeScore: (range) => {
    try {
      const [highest] = semverSort(new SemverRange(range).set.map(c => c[0].semver))
      return semver.score(highest)
    } catch {
      return 0
    }
  },
}

export const date = {
  format: (d) => new Intl.DateTimeFormat('en').format(new Date(d)),
  range: (days) => {
    const DAY = 24 * 60 * 60 * 1000
    const range = [new Date()]
    for (let i = 1; i < days; i++) {
      range.push(new Date(range[0] - i * DAY))
    }
    return range.reverse().map((d) => date.format(d))
  },
  fromNow: (d) => {
    try {
      return formatDistanceToNowStrict(new Date(d)) + ' ago'
    } catch {
      return 'Unknown'
    }
  },
}

export const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length

export const uniq = (arr) => arr.filter(v => v != null).filter((v, i, a) => a.indexOf(v) === i)

export const num = {
  format: (n) => new Intl.NumberFormat('en-US').format(n),
}

export const titleCase = (str) => str.replace(/\w\S*/g,
  (t) => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()
)
