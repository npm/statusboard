import dataPath from './data/cli-deps.json'
import metadataPath from './data/metadata.json'
import {
  checkState, compareVersions as versionComparison, requiredLines as getRequiredLines,
} from './js/cli-deps-model.mjs'

const readJson = async url => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not load collected data: HTTP ${response.status}`)
  }
  return response.json()
}

const start = async () => {
  try {
    const [data, metadata] = await Promise.all([readJson(dataPath), readJson(metadataPath)])
    if (data.schemaVersion !== 1 || !data.cli?.length || !data.rows?.length) {
      throw new Error('Unsupported or empty CLI dependency dataset')
    }
    data.cli.sort((a, b) => b.major - a.major)
    const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
    const sourceLink = (url, text, className = '') =>
    `<a href="${escape(url)}" class="${className}" target="_blank" rel="noopener noreferrer">${text}</a>`
    const repoUrl = repository => `https://github.com/${repository}`
    const blobUrl = (row) => `${repoUrl(row.repository)}/blob/${row.branchCommit}/${row.manifestPath}`
    const none = '<span class="none" aria-label="None">&mdash;</span>'
    const checkStates = {
      passing: { label: 'Passing', icon: '&#10003;' },
      failing: { label: 'Failing', icon: '&#10005;' },
      running: { label: 'Running', icon: '&#9679;' },
      pending: { label: 'Pending', icon: '&#9675;' },
      neutral: { label: 'Neutral', icon: '&minus;' },
      'no-checks': { label: 'No checks', icon: '&minus;' },
      'not-collected': { label: 'Not collected', icon: '&minus;' },
      unavailable: { label: 'Unavailable', icon: '!' },
    }
    const checkBadge = (repository, branch, commit) => {
      const result = data.checks?.branches?.[`${repository}:${branch}`]
      const { state, note } = checkState(result, commit)
      const presentation = checkStates[state]
      const title = `${repository} / ${branch}: ${presentation.label}\n${note}\nCommit: ${commit}\nCollected: ${result?.checkedAt || 'not collected'}`
      return `<a class="check-badge check-${state}" href="${repoUrl(repository)}/commit/${commit}/checks"
      target="_blank" rel="noopener noreferrer" title="${escape(title)}"
      aria-label="${escape(`${repository}, ${branch}: ${presentation.label}`)}"
      data-check-state="${state}" data-repository="${escape(repository)}" data-branch="${escape(branch)}" data-commit="${commit}">
      <span aria-hidden="true">${presentation.icon}</span>${presentation.label}</a>`
    }
    const rowsByRepo = new Map(data.repositorySummary.map(repo =>
      [repo.repository, data.rows.filter(row => row.repository === repo.repository)
        .sort((a, b) => a.package.localeCompare(b.package) || b.packageMajor - a.packageMajor)]))
    const reposByName = new Map(data.repositorySummary.map(repo => [repo.repository, repo]))
    const indexes = new Map(data.repositorySummary.map((repo, index) => [repo.repository, index]))
    const expanded = new Set()
    const search = document.getElementById('search')
    const cliFilter = document.getElementById('cli-filter')
    const versionFilter = document.getElementById('version-filter')
    const gapsOnly = document.getElementById('gaps-only')
    const tbody = document.getElementById('repository-rows')
    let sort = { key: 'repository', direction: 'asc' }

    const gaps = repo => [...new Set(repo.missingPackageMajors.map(gap => gap.requiredBranch))]
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
    const existingBranches = repo => [...repo.neededExistingBranches].sort((a, b) =>
      Number(b === repo.defaultBranch) - Number(a === repo.defaultBranch) ||
    b.localeCompare(a, 'en', { numeric: true }))
    const requiredLines = (repo, major) =>
      getRequiredLines(repo, major, rowsByRepo.get(repo.repository))
    const searchIndex = new Map(data.repositorySummary.map(repo => [repo.repository, [
      repo.repository, ...repo.packages, repo.defaultBranch, repo.defaultVersion,
      ...repo.neededExistingBranches, ...gaps(repo),
      ...data.cli.flatMap(cli => requiredLines(repo, cli.major).map(line => line.label)),
      ...rowsByRepo.get(repo.repository).flatMap(row => Object.values(row.integrated).flat()
        .map(version => version.version)),
    ].join(' ').toLowerCase()]))

    const shortDate = value => new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(value))
    const build = process.env.BUILD_CONTEXT
    const buildBadge = document.getElementById('build-badge')
    buildBadge.textContent = `Built: ${shortDate(build.date)} UTC`
    buildBadge.title = `${build.date} - ${build.sha}`
    const collection = metadata['fetch-cli-deps']
    const stale = Date.now() - new Date(data.analyzedAt).getTime() > 48 * 60 * 60 * 1000
    const freshness = document.getElementById('freshness')
    const dataBadge = document.getElementById('data-badge')
    dataBadge.className = `metadata-badge badge-${collection?.error ? 'danger' : stale ? 'warning' : 'success'}`
    dataBadge.textContent = `Data: ${shortDate(data.analyzedAt)} UTC${stale ? ' (stale)' : ''}`
    dataBadge.title = `Last successful collection: ${collection?.success || data.analyzedAt}`
    const collected = data.analyzedAt.replace('T', ' ').replace('Z', ' UTC')
    if (collection?.error) {
      freshness.classList.add('failed')
      freshness.textContent = `Refresh failed ${collection.error}: ${collection.message || 'See the data workflow logs'}. Showing last successful data collected ${collected}.`
    } else if (stale) {
      freshness.textContent = `No successful refresh in over 48 hours. Showing data collected ${collected}; use the data workflow to refresh it.`
    } else {
      freshness.classList.add('current')
      freshness.textContent = `Collected ${collected} from pinned CLI inputs. Refreshes daily or through the manual data workflow; not a live browser scan.`
    }
    const unattributed = data.scope.unattributed
    document.getElementById('ownership-note').textContent = unattributed.length
      ? `Ownership could not be attributed for ${unattributed.length} packages; these are excluded from the npm-owned table: ${unattributed.map(item => item.package).join(', ')}.`
      : 'All dependency repository declarations were attributed.'
    if (unattributed.length) {
      freshness.textContent += ` ${unattributed.length} packages have unattributed ownership; see scope.`
    }
    document.getElementById('totals').innerHTML = [
      [data.summary.repositories, 'repositories'], [data.summary.packages, 'packages'],
      [data.summary.requiredExistingRepositoryBranches, 'existing branch lines'],
      [data.summary.missingPackageMajorLines, 'potential gaps'],
    ].map(([count, label]) => `<span><strong>${count}</strong> ${label}</span>`).join('')
    document.getElementById('inputs').innerHTML = data.cli.map(cli => `<li>
    <strong>CLI v${cli.major}</strong> <code>${escape(cli.version)}</code>
    <small><code>${escape(cli.branch)}</code> &middot; ${sourceLink(
      `${repoUrl('npm/cli')}/commit/${cli.commit}`,
      `<code title="${escape(cli.commit)}">${cli.commit.slice(0, 12)}</code>`
    )}</small></li>`).join('')
    document.getElementById('provenance').innerHTML =
    `CLI inputs pinned: <code>${escape(data.checkedAt)}</code>. Collection completed: <code>${escape(data.analyzedAt)}</code>. Dates do not advance when this page is opened; a failed refresh retains the last successful dataset.`
    const checksProvenance = document.getElementById('checks-provenance')
    const collectionBadge = document.getElementById('collection-badge')
    if (data.checks?.status === 'complete') {
      collectionBadge.className = 'metadata-badge badge-success'
      collectionBadge.textContent = `Checks collected: ${shortDate(data.checks.checkedAt)} UTC`
      collectionBadge.title = `Collection completed ${data.checks.checkedAt}. Individual branch checks may be failing.`
      checksProvenance.textContent =
      `Checks collected ${data.checks.checkedAt.replace('T', ' ').replace('Z', ' UTC')} for these pinned commits, not current branch tips. Badges do not refresh when opened.`
    } else {
      collectionBadge.className = 'metadata-badge badge-danger'
      collectionBadge.textContent = 'Checks: incomplete or unavailable'
      checksProvenance.classList.add('unavailable')
      checksProvenance.textContent = 'Check collection is incomplete or unavailable. Badges must not be interpreted as a complete CI scan.'
    }
    cliFilter.insertAdjacentHTML('beforeend', data.cli.map(cli =>
    `<option value="${cli.major}">CLI v${cli.major}</option>`).join(''))

    const branchCell = (repo, branch) => {
      const matches = rowsByRepo.get(repo.repository).filter(row => row.branch === branch)
      const cli = repo.repository === 'npm/cli' && data.cli.find(input => input.branch === branch)
      const versions = cli ? [cli.version]
        : [...new Set(matches.map(row => row.branchCurrentVersion))]
      const commit = cli ? cli.commit : matches[0].branchCommit
      return `<div class="branch-item">${sourceLink(`${repoUrl(repo.repository)}/tree/${commit}`,
      `<code class="branch">${escape(branch)}</code>`)}<span class="version">${versions.map(escape).join(', ')}</span>
      ${checkBadge(repo.repository, branch, commit)}</div>`
    }
    const lineRequirements = (rows, major) => rows.map(row => ({
      package: row.package,
      target: row.published?.version,
      versions: row.integrated[major].map(version => version.version),
    }))
    const overallRequirements = (repo, major) => {
      const rows = rowsByRepo.get(repo.repository).filter(row => row.integrated[major].length)
      return [...new Set(rows.map(row => row.package))].map(name => ({
        package: name,
        target: data.latestStableByPackage?.[name]?.version,
        versions: rows.filter(row => row.package === name)
          .flatMap(row => row.integrated[major].map(version => version.version)),
      }))
    }
    const matchingComparisonRows = repo => {
      const rows = rowsByRepo.get(repo.repository)
      if (!versionFilter.value) {
        return rows
      }
      const majors = cliFilter.value ? [Number(cliFilter.value)] : data.cli.map(cli => cli.major)
      return rows.filter(row => majors.some(major => {
        if (!row.integrated[major].length) {
          return false
        }
        const requirements = versionFilter.value === 'line' ? lineRequirements([row], major)
          : overallRequirements(repo, major).filter(item => item.package === row.package)
        const { state } = versionComparison(requirements, versionFilter.value)
        return state === 'missing' || state === 'mixed'
      }))
    }
    const versionStatus = (requirements, kind) => {
      if (!requirements.length) {
        return ''
      }
      const { state, missing } = versionComparison(requirements, kind)
      const label = kind === 'line' ? 'in line' : 'overall'
      const target = missing.length === 1 ? `<code>${escape(missing[0].target)}</code>`
        : `${missing.length}/${requirements.length} packages`
      const text = state === 'unknown' ? `Latest ${label} unavailable`
        : state === 'missing' ? `${kind === 'line' ? 'In line' : 'Overall'}: ${target} missing`
        : state === 'mixed' ? 'Latest in line + other copies' : `Latest ${label}`
      const icon = state === 'integrated' || state === 'mixed' ? '&#10003;' : state === 'missing' ? '&#8593;' : '&mdash;'
      return `<span class="version-status version-${state}" data-version-kind="${kind}" data-version-state="${state}">
      <span aria-hidden="true">${icon}</span> ${text}</span>`
    }
    const requiredLineCell = (repo, line, major) => {
      const href = line.commit ? `${repoUrl(repo.repository)}/tree/${line.commit}` : null
      const labelClass = `line${line.production ? '' : ' dev'}`
      const label = !line.branch && href
        ? sourceLink(href, escape(line.label), labelClass)
        : `<span class="${labelClass}">${escape(line.label)}</span>`
      const branch = !line.branch ? '' : href
        ? sourceLink(href, `(${escape(line.branch)})`, 'line-branch')
        : `<code class="line-branch missing">(${escape(line.branch)})</code>`
      return `<div class="line-item">${label} ${branch}
      ${line.production ? '' : '<span class="usage">dev-only</span>'}
      ${versionStatus(lineRequirements(line.comparisons, major), 'line')}</div>`
    }
    const integrationCell = (row, major) => row.integrated[major].length
      ? row.integrated[major].map(version => `<span class="integration"><code>${escape(version.version)}</code>
      ${version.production ? '' : '<span class="usage">dev-only</span>'}
      ${major === data.cli[0].major && version.version === data.latestStableByPackage?.[row.package]?.version
        ? '<span class="version-status version-integrated">Latest overall</span>'
        : version.version === row.published?.version
          ? '<span class="version-status version-integrated">Latest in line</span>' : ''}
      ${version.behindPublished ? '<span class="lag">Behind newest stable in this major</span>' : ''}</span>`).join('')
      : none
    const repoDetails = repo => {
      const rows = matchingComparisonRows(repo)
      const packages = versionFilter.value
        ? [...new Set(rows.map(row => row.package))] : repo.packages
      return `<div class="detail-panel">
      <div class="detail-heading"><h2>${escape(repo.repository)} / exact comparisons</h2>
        <small>Default commit ${sourceLink(`${repoUrl(repo.repository)}/commit/${repo.defaultCommit}`,
          `<code title="${escape(repo.defaultCommit)}">${repo.defaultCommit.slice(0, 12)}</code>`)}</small></div>
      <p class="package-list"><strong>Packages:</strong> ${packages.map(pkg => `<code>${escape(pkg)}</code>`).join(', ')}</p>
      ${versionFilter.value ? `<p class="detail-note">Showing matching package comparisons only,
        for ${cliFilter.value ? `CLI v${cliFilter.value}` : 'any CLI line'}. Clear Version status to see every comparison.</p>` : ''}
      ${repo.repository === 'npm/template-oss' ? `<p class="detail-note"><strong>Tooling alignment:</strong>
        template-oss is expected to stay current on supported CLI branches. Older direct pins are alignment work,
        not a recommendation to maintain its historical dependency tree. This snapshot does not establish cross-major upgrade compatibility.</p>` : ''}
      <table class="comparison" aria-label="Exact package comparisons for ${escape(repo.repository)}">
        <thead><tr><th scope="col">Package / major</th><th scope="col">Required branch</th>
          <th scope="col">Branch HEAD</th><th scope="col">Newest stable<br>in this major</th>
          <th scope="col">Latest stable<br>overall</th>
          ${data.cli.map(cli => `<th scope="col"${cliFilter.value === String(cli.major) ? ' class="filter-target"' : ''}>CLI v${cli.major}<br>integrated</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr><td><code>${escape(row.package)}</code><br>v${row.packageMajor}</td>
          <td>${row.branch ? `${sourceLink(blobUrl(row), `<code>${escape(row.branch)}</code>`)}<br>${checkBadge(row.repository, row.branch, row.branchCommit)}`
            : `<span class="required-branch">${escape(row.requiredBranch)}</span><br><span class="usage">Potential gap</span>`}</td>
          <td>${row.branchCurrentVersion ? `<code>${escape(row.branchCurrentVersion)}</code>` : none}</td>
          <td>${row.published ? sourceLink(`https://registry.npmjs.org/${encodeURIComponent(row.package)}/${row.published.version}`,
            `<code>${escape(row.published.version)}</code>`) : none}</td>
          <td>${data.latestStableByPackage?.[row.package]?.version
            ? sourceLink(`https://registry.npmjs.org/${encodeURIComponent(row.package)}/${data.latestStableByPackage[row.package].version}`,
              `<code>${escape(data.latestStableByPackage[row.package].version)}</code>`)
            : '<span class="none">Unavailable</span>'}</td>
          ${data.cli.map(cli => `<td>${integrationCell(row, cli.major)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <details class="path-summary"><summary>Dependency paths from pinned CLI inputs</summary>
        ${rows.map(row => `<section class="path-group"><h3><code>${escape(row.package)}</code> v${row.packageMajor}</h3>
          <ul>${data.cli.flatMap(cli => row.paths[cli.major].map(path =>
            `<li><strong>CLI v${cli.major}:</strong> <code>${escape(path)}</code></li>`)).join('')}</ul></section>`).join('')}
      </details>
    </div>`
    }
    const render = () => {
      const query = search.value.trim().toLowerCase()
      const visible = data.repositorySummary.filter(repo =>
        (!query || searchIndex.get(repo.repository).includes(query)) &&
      (!cliFilter.value || repo.cli[cliFilter.value]?.length) &&
      (!versionFilter.value || matchingComparisonRows(repo).length) &&
      (!gapsOnly.checked || gaps(repo).length))
      visible.sort((a, b) => {
        const comparison = sort.key === 'gaps' ? gaps(a).length - gaps(b).length : a.repository.localeCompare(b.repository)
        return (sort.direction === 'asc' ? comparison : -comparison) || a.repository.localeCompare(b.repository)
      })
      document.getElementById('column-headings').innerHTML = `
      <th scope="col" aria-sort="${sort.key === 'repository' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}">
        <button type="button" class="sort" data-sort="repository">Repository<span class="sort-icon" aria-hidden="true">${sort.key === 'repository' ? (sort.direction === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;'}</span></button></th>
      <th scope="col">Current default<br>branch / version</th>
      ${data.cli.map(cli => `<th scope="col" class="cli-column${cliFilter.value === String(cli.major) ? ' filter-target' : ''}">CLI v${cli.major}<small>Required lines${cliFilter.value === String(cli.major) ? ' &middot; selected' : ''}</small></th>`).join('')}
      <th scope="col" class="branches-column">Existing branches required</th>
      <th scope="col" class="gaps-column" aria-sort="${sort.key === 'gaps' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}">
        <button type="button" class="sort" data-sort="gaps">Potential gaps<span class="sort-icon" aria-hidden="true">${sort.key === 'gaps' ? (sort.direction === 'asc' ? '&#8593;' : '&#8595;') : '&#8597;'}</span></button><small>Required branch names</small></th>`
      tbody.innerHTML = visible.map(repo => {
        const open = expanded.has(repo.repository)
        const detailId = `details-${indexes.get(repo.repository)}`
        const packageLabel = versionFilter.value
          ? `Matches: ${[...new Set(matchingComparisonRows(repo).map(row => row.package))].join(', ')}`
          : repo.packages.length > 1 ? `${repo.packages.length} workspace packages`
          : repo.packages[0] !== repo.repository.split('/')[1] ? repo.packages[0] : ''
        return `<tr class="repository-row${open ? ' expanded' : ''}" data-repository="${escape(repo.repository)}">
        <td><div class="repo-label"><button type="button" class="expand" data-expand="${escape(repo.repository)}"
          aria-expanded="${open}" aria-controls="${detailId}" aria-label="${open ? 'Hide' : 'Show'} details for ${escape(repo.repository)}">${open ? '&minus;' : '+'}</button>
          <div>${sourceLink(repoUrl(repo.repository), escape(repo.repository), 'repo-name')}
            ${packageLabel ? `<span class="package-label">${escape(packageLabel)}</span>` : ''}</div></div></td>
        <td>${sourceLink(`${repoUrl(repo.repository)}/tree/${repo.defaultCommit}`,
          `<code class="default-branch">${escape(repo.defaultBranch)}</code>`)}<span class="default-check"><span class="version">${escape(repo.defaultVersion)}</span>
          ${checkBadge(repo.repository, repo.defaultBranch, repo.defaultCommit)}</span></td>
        ${data.cli.map(cli => `<td>${requiredLines(repo, cli.major).map(line =>
          requiredLineCell(repo, line, cli.major)).join('') || none}
          ${(cli.major === data.cli[0].major || versionFilter.value === 'overall' && (!cliFilter.value || cliFilter.value === String(cli.major))) && repo.cli[cli.major]?.length
            ? `<div class="overall-status">${versionStatus(overallRequirements(repo, cli.major), 'overall')}</div>` : ''}</td>`).join('')}
        <td>${existingBranches(repo).map(branch => branchCell(repo, branch)).join('') || none}</td>
        <td>${gaps(repo).map(branch => `<span class="required-branch">${escape(branch)}</span>`).join('') || none}
          ${repo.repository === 'npm/template-oss' ? '<span class="alignment-note">Tooling alignment, not a branch recommendation</span>' : ''}</td>
        </tr><tr class="detail-row" id="${detailId}"${open ? '' : ' hidden'}><td colspan="${data.cli.length + 4}">
          ${open ? repoDetails(repo) : ''}</td></tr>`
      }).join('') || `<tr><td colspan="${data.cli.length + 4}" class="empty"><strong>No matching repositories.</strong><br>Clear the search or reset the filters.</td></tr>`
      const filterNote = document.getElementById('version-filter-note')
      filterNote.hidden = !versionFilter.value
      const target = cliFilter.value ? `CLI v${cliFilter.value}` : 'any CLI line'
      filterNote.textContent = versionFilter.value === 'line'
        ? `Not latest in line for ${target}: missing latest-in-major releases or mixed copies. Other CLI columns remain visible for context.`
        : `Latest stable overall is not integrated in ${target}, even if its required major is current. Other CLI columns remain visible for context.`
      const packageCount = new Set(visible.flatMap(repo =>
        matchingComparisonRows(repo).map(row => row.package))).size
      document.getElementById('results').textContent = versionFilter.value
        ? `${packageCount} packages in ${visible.length} repositories (${target})`
        : `${visible.length} of ${data.repositorySummary.length} repositories`
    }

    search.addEventListener('input', render)
    cliFilter.addEventListener('change', render)
    versionFilter.addEventListener('change', render)
    gapsOnly.addEventListener('change', render)
    document.getElementById('reset').addEventListener('click', () => {
      search.value = ''
      cliFilter.value = ''
      versionFilter.value = ''
      gapsOnly.checked = false
      expanded.clear()
      sort = { key: 'repository', direction: 'asc' }
      render()
    })
    document.getElementById('column-headings').addEventListener('click', event => {
      const button = event.target.closest('button[data-sort]')
      if (!button) {
        return
      }
      const key = button.dataset.sort
      sort = { key, direction: sort.key === key ? (sort.direction === 'asc' ? 'desc' : 'asc') : key === 'gaps' ? 'desc' : 'asc' }
      render()
      document.querySelector(`[data-sort="${key}"]`).focus()
    })
    tbody.addEventListener('click', event => {
      const button = event.target.closest('button[data-expand]')
      if (!button) {
        return
      }
      const name = button.dataset.expand
      const open = !expanded.has(name)
      if (open) {
        expanded.add(name)
      } else {
        expanded.delete(name)
      }
      button.setAttribute('aria-expanded', String(open))
      button.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} details for ${name}`)
      button.innerHTML = open ? '&minus;' : '+'
      button.closest('tr').classList.toggle('expanded', open)
      const details = document.getElementById(button.getAttribute('aria-controls'))
      if (open && !details.firstElementChild.firstElementChild) {
        details.firstElementChild.innerHTML = repoDetails(reposByName.get(name))
      }
      details.hidden = !open
    })
    render()
  } catch (error) {
    const message = document.getElementById('error')
    message.hidden = false
    message.textContent = `CLI dependency data could not be displayed: ${error.message}`
    const freshness = document.getElementById('freshness')
    freshness.className = 'snapshot failed'
    freshness.textContent = 'No complete CLI dependency dataset could be loaded.'
    const badge = document.getElementById('data-badge')
    badge.className = 'metadata-badge badge-danger'
    badge.textContent = 'Data: unavailable'
    throw error
  }
}

start()
