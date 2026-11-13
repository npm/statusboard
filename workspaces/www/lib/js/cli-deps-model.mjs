export const compareVersions = (requirements, kind) => {
  const unknown = requirements.some(item => !item.target)
  const missing = requirements.filter(item => item.target && !item.versions.includes(item.target))
  const mixed = kind === 'line' && requirements.some(item =>
    item.versions.includes(item.target) && item.versions.some(version => version !== item.target))
  const state = unknown ? 'unknown' : missing.length ? 'missing' : mixed ? 'mixed' : 'integrated'
  return { state, missing }
}

export const requiredLines = (repo, major, rows) => {
  const groups = new Map()
  for (const entry of repo.cli[major] || []) {
    const comparison = rows.find(row =>
      row.package === entry.package && row.packageMajor === entry.major &&
      row.branch === entry.branch)
    if (!comparison) {
      throw new Error(`Missing comparison for ${repo.repository}, ${entry.package}, CLI ${major}`)
    }
    const branch = entry.branch || comparison.requiredBranch
    const label = repo.repository === 'npm/cli' ? branch : `v${entry.major}`
    const key = `${label}:${branch}`
    const previous = groups.get(key)
    groups.set(key, {
      label,
      branch: repo.repository === 'npm/cli' ? null : branch,
      commit: comparison.branchCommit,
      production: Boolean(previous?.production ||
        entry.versions.some(version => version.production)),
      major: entry.major,
      comparisons: [...(previous?.comparisons || []), comparison],
    })
  }
  return [...groups.values()].sort((a, b) => b.major - a.major)
}

export const checkState = (result, commit) => {
  if (!result) {
    return { state: 'not-collected', note: 'Check results were not collected for this branch.' }
  }
  if (result.commit !== commit) {
    return { state: 'unavailable', note: 'Collected check results belong to a different commit.' }
  }
  if (result.error) {
    return { state: 'unavailable', note: `Collection failed: ${result.error}` }
  }
  if (!Object.hasOwn(result, 'rollup')) {
    return { state: 'unavailable', note: 'The collected response is missing its check results.' }
  }
  const rollup = result.rollup
  if (rollup === null || rollup?.contexts?.totalCount === 0) {
    return { state: 'no-checks', note: 'GitHub returned no checks or statuses for this commit.' }
  }
  const contexts = rollup?.contexts
  if (!contexts || !Number.isInteger(contexts.totalCount) || contexts.totalCount < 1 ||
      !Array.isArray(contexts.checkRunCountsByState) ||
      !Array.isArray(contexts.statusContextCountsByState)) {
    return { state: 'unavailable', note: 'Malformed check results.' }
  }
  const count = (values, name) => values.find(item => item.state === name)?.count || 0
  let state = 'unavailable'
  if (rollup.state === 'FAILURE' || rollup.state === 'ERROR') {
    state = 'failing'
  } else if (rollup.state === 'PENDING' || rollup.state === 'EXPECTED') {
    state = count(contexts.checkRunCountsByState, 'IN_PROGRESS') ? 'running' : 'pending'
  } else if (rollup.state === 'SUCCESS') {
    state = count(contexts.checkRunCountsByState, 'SUCCESS') +
      count(contexts.statusContextCountsByState, 'SUCCESS') ? 'passing' : 'neutral'
  }
  return {
    state,
    note: `${contexts.totalCount} combined checks and statuses; GitHub rollup: ${rollup.state}.`,
  }
}
