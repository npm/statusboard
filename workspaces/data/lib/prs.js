module.exports = ({ prs, repo, history }) => {
  if (!prs || !repo) {
    return null
  }

  const result = {
    count: prs.length,
    url: repo.html_url + '/pulls',
  }

  if (history) {
    result.history = [...history.map((p) => p.count), prs.length]
  }

  return result
}
