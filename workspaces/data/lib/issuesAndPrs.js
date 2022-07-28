module.exports = ({ items, url, history, filters = {} }) => {
  if (!items || !url) {
    return null
  }

  const getUrl = (newQuery = '') => {
    const u = new URL(url.toString())
    const currentQuery = u.searchParams.get('q') || ''
    u.searchParams.set('q', `${currentQuery} ${newQuery}`.trim())
    return u.toString()
  }

  const filterEntries = Object.entries(filters)

  const data = {
    count: items.length,
    url: getUrl(),
    ...filterEntries.reduce((acc, [key, value]) => {
      acc[key] = value.filter ? {
        count: 0,
        url: getUrl(value.url),
      } : null
      return acc
    }, {}),
  }

  for (const item of items) {
    for (const [name, { filter, find }] of filterEntries) {
      const isFiltered = filter && filter(item)
      const isFound = find && !data[name] && find(item)

      if (isFiltered) {
        data[name].count++
      } else if (isFound) {
        data[name] = isFound
      }
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
        if (v && Object.hasOwn(v, 'count')) {
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
