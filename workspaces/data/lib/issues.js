module.exports = ({ issues, url, history }) => {
  if (!issues || !url) {
    return null
  }

  const getUrl = (q) => {
    const u = new URL(url + '/issues')
    if (q) {
      const params = new URLSearchParams({
        q: `is:issue is:open ${q}`,
      })
      u.search = params.toString()
    }
    return u.toString()
  }

  const data = {
    count: issues.length,
    url: getUrl(),
    priority: {
      count: 0,
      url: getUrl('label:"Priority 1","Priority 0'),
    },
    triage: {
      count: 0,
      url: getUrl('label:"Needs Triage"'),
    },
    noLabel: {
      count: 0,
      url: getUrl('no:label'),
    },
  }

  for (const issue of issues) {
    const labels = issue.labels.map(l => l.name)

    if (!labels.length) {
      data.noLabel.count++
    }
    if (labels.includes('Priority 0') || labels.includes('Priority 1')) {
      data.priority.count++
    }
    if (labels.includes('Needs Triage')) {
      data.triage.count++
    }
  }

  if (history) {
    const updates = [...history, data]
    for (const update of updates) {
      if (!data.history) {
        data.history = []
      }
      data.history.push(update.count)
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v === 'object' && !Array.isArray(v)) {
          if (!data[k].history) {
            data[k].history = []
          }
          data[k].history.push(update[k].count)
        }
      })
    }
  }

  return data
}
