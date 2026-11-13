export default (graphql) => {
  const getDependencyRepositories = async (names) => {
    const query = `query {
      ${names.map((repository, index) => {
        const [owner, name] = repository.split('/')
        return `r${index}: repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) {
          nameWithOwner isArchived
          defaultBranchRef { name target { oid ... on Commit { committedDate } } }
        }`
      }).join('\n')}
    }`
    let response
    try {
      response = await graphql(query)
    } catch (error) {
      if (!error.data || !error.errors?.length ||
          !error.errors.every(item => item.type === 'NOT_FOUND')) {
        throw error
      }
      response = error.data
    }
    return names.map((name, index) => response[`r${index}`])
  }

  const getDependencyRefs = async (repository) => {
    const [owner, name] = repository.split('/')
    const branches = []
    let after = null
    let defaultBranch
    do {
      const response = await graphql(`query($owner:String!,$name:String!,$after:String) {
        repository(owner:$owner,name:$name) {
          defaultBranchRef { name }
          refs(refPrefix:"refs/heads/",first:100,after:$after) {
            nodes { name target { oid ... on Commit { committedDate } } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`, { owner, name, after })
      if (!response.repository?.defaultBranchRef) {
        throw new Error(`Missing default branch for ${repository}`)
      }
      defaultBranch = response.repository.defaultBranchRef.name
      const refs = response.repository.refs
      branches.push(...refs.nodes.map(ref => ({
        name: ref.name,
        commit: ref.target.oid,
        committedAt: ref.target.committedDate,
        default: ref.name === defaultBranch,
      })))
      after = refs.pageInfo.hasNextPage ? refs.pageInfo.endCursor : null
    } while (after)
    return { defaultBranch, branches }
  }

  const getDependencyFiles = async (repository, commit, paths) => {
    if (!paths.length) {
      return {}
    }
    const [owner, name] = repository.split('/')
    const response = await graphql(`query($owner:String!,$name:String!) {
      repository(owner:$owner,name:$name) {
        commit: object(oid:${JSON.stringify(commit)}) { ... on Commit { oid } }
        ${paths.map((file, index) => `f${index}: object(expression:${JSON.stringify(`${commit}:${file}`)}) {
          ... on Blob { text }
        }`).join('\n')}
      }
    }`, { owner, name })
    if (response.repository?.commit?.oid !== commit) {
      throw new Error(`Missing commit ${repository}@${commit}`)
    }
    return Object.fromEntries(paths.map((file, index) => {
      const blob = response.repository[`f${index}`]
      if (blob && typeof blob.text !== 'string') {
        throw new Error(`Unreadable file ${repository}@${commit}:${file}`)
      }
      return [file, blob ? JSON.parse(blob.text) : null]
    }))
  }

  const getDependencyChecks = async (requests) => {
    const response = await graphql(`query {
      ${requests.map(({ repository, commit }, index) => {
        const [owner, name] = repository.split('/')
        return `r${index}: repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}) {
          object(oid:${JSON.stringify(commit)}) {
            ... on Commit {
              oid
              statusCheckRollup {
                state
                contexts(first:1) {
                  totalCount
                  checkRunCountsByState { state count }
                  statusContextCountsByState { state count }
                }
              }
            }
          }
        }`
      }).join('\n')}
    }`)
    return requests.map((request, index) => {
      const commit = response[`r${index}`]?.object
      if (commit?.oid !== request.commit) {
        throw new Error(`Check collection could not read ${request.repository}@${request.commit}`)
      }
      return { ...request, rollup: commit.statusCheckRollup }
    })
  }

  return { getDependencyRepositories, getDependencyRefs, getDependencyFiles, getDependencyChecks }
}
