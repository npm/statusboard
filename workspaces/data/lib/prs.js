module.exports = ({ prs, url, history }) => {
  if (!prs || !url) {
    return null
  }

  const result = {
    count: prs.length,
    url: url + '/pulls',
  }

  if (history) {
    result.history = [...history.map((p) => p.count), prs.length]
  }

  return result
}
