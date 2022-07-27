/* globals $, sparkline */

const TREND_DAYS = [7, 30, 90]
const NOPUB = 'None'

const EL = {
  // eslint-disable-next-line max-len
  githubIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`,
  // eslint-disable-next-line max-len
  npmIcon: `<svg viewBox="0 0 27.23 27.23"><rect width="27.23" height="27.23" rx="2"></rect><polygon fill="#fff" points="5.8 21.75 13.66 21.75 13.67 9.98 17.59 9.98 17.58 21.76 21.51 21.76 21.52 6.06 5.82 6.04 5.8 21.75"></polygon></svg>`,
  icon: (name) => `<i class="bi-${name}"></i>`,
  link: ({ class: c = '', href, text }) => `<a href="${href}" class="${c}">${text}</a>`,
  badge: ({ type, href, text }) => {
    const classes = `badge badge-dt badge-${type}`
    return href ? EL.link({ class: classes, href, text }) : `<div class="${classes}">${text}</div>`
  },
  cell: (opts) => opts.type ? EL.badge(opts) : opts.href ? EL.link(opts) : opts.text,
  noData: (opts) => EL.cell({ text: 'N/A', ...opts }),
}

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
const uniq = (arr) => arr.filter(v => v != null).filter((v, i, a) => a.indexOf(v) === i)
const numFormat = (n) => new Intl.NumberFormat('en-US').format(n)

const date = {
  format: (d) => new Intl.DateTimeFormat('en').format(new Date(d)),
  range: (days) => {
    const DAY = 24 * 60 * 60 * 1000
    const range = [new Date()]
    for (let i = 1; i < days; i++) {
      range.push(new Date(range[0] - i * DAY))
    }
    return range.reverse().map((d) => date.format(d))
  },
}

// too hard to pull in a browser compatible version of semver?
// just write your own! (im sorry, remove this if we have a real frontend build process)
const semver = {
  version: {
    parse: (v) => {
      const [major = 0, minor = 0, patch = 0] = v.split('.').map((n) => +n)
      return [major, minor, patch]
    },
    score: (v) => {
      const [major, minor, patch] = Array.isArray(v) ? v : semver.version.parse(v)
      return major * 1e7 + minor * 1e4 + patch * 1
    },
  },
  range: {
    parse: (r) => (r || '')
      .replace(/(>=|\^|\s)/g, '')
      .split('||')
      .map(semver.version.parse)
      .sort((a, b) => semver.version.score(b) - semver.version.score(a)),
    stringify: (r) => (Array.isArray(r) ? r : semver.range.parse(r))
      .map((v) => v.join('.')).join('-'),
  },
}

const selectors = {
  templateOSS: (projects) => projects.find((p) => p.name === 'template-oss'),
  noArchived: (projects) => projects.every((p) => !p.archived),
  isWorkspace: (p) => !!p.path,
  isPrivate: (p) => !!p.pkgPrivate,
  isPublished: (p) => !!p.lastPublished,
  wsDir: (p) => selectors.isWorkspace(p) ? p.path.substring(p.path.lastIndexOf('/') + 1) : null,
  names: (project) => {
    const pkgName = project.pkgName || ''
    // all our scopes should be the same or similar so dont use those for filtering/sorting
    const noScope = pkgName.split('/')[1] || pkgName
    // the repo name is the name of the folder for workspaces or the name of the repo
    const repoName = selectors.isWorkspace(project) ? selectors.wsDir(project) : project.name

    const allNames = uniq([pkgName, noScope, repoName])
    const noScopeNames = uniq([noScope, repoName])

    // a private pkg should only be looked up by repo name since the package.json might not be
    // relavant and for everything else display the full pkgname but filter without scope
    return !pkgName ? {
      display: repoName,
      filter: repoName,
      sort: repoName,
    } : {
      display: allNames[0],
      filter: noScopeNames,
      sort: noScopeNames[0],
    }
  },
}

const drawTrendline = (cell, data, days) => {
  const container = cell.querySelector('.trendline-container')
  if (!container) {
    return
  }

  const trendlineDates = date.range(days)
  const daysData = data.slice(days * -1)
  const fullData = [...new Array(daysData.length - daysData.length).fill(0), ...daysData]

  const scrollBody = document.querySelector('.dataTables_scrollBody')
  const trendlineData = container.querySelector('.trendline-data')
  const trendlineDate = container.querySelector('.trendline-date')
  const trendlineValue = container.querySelector('.trendline-value')

  sparkline.sparkline(
    container.querySelector('.sparkline'),
    fullData,
    {
      onmousemove: (e, { index, value }) => {
        scrollBody.classList.add('with-tooltip')
        trendlineData.classList.add('active')
        trendlineDate.innerHTML = trendlineDates[index]
        trendlineValue.innerHTML = value
      },
      onmouseout: () => {
        scrollBody.classList.remove('with-tooltip')
        trendlineData.classList.remove('active')
      },
    }
  )
}

const renderIssues = ({ data: key, title, danger = 20, warning = 1 }) => {
  return {
    [`${key}.count`]: {
      title,
      defaultContent: 0,
      render: (data, row) => {
        if (selectors.isWorkspace(row) && data == null) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        const type = data >= danger ? 'danger' : data >= warning ? 'warning' : 'success'
        const rowIssues = key.split('.').reduce((acc, k) => acc[k], row)
        return {
          sort: data,
          display: EL.cell({ text: numFormat(data), type, href: rowIssues.href }),
        }
      },
    },
    [`${key}.history`]: {
      title,
      visible: false,
      type: 'num',
      defaultContent: 0,
      render: (data, row) => {
        if (selectors.isWorkspace(row) && data == null) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        if ((data && data.length) <= 1 || data.every(d => d === 0)) {
          // sparkline can't do all 0s and needs more than one data point
          return {
            sort: 0,
            display: EL.noData({ text: 'No Data' }),
          }
        }
        return {
          sort: avg(data),
          display: `
            <div class="trendline-container">
              <div class="trendline-data">
                  <span class="trendline-date"></span>
                  <span class="trendline-value"></span>
              </div>
              <svg class="sparkline" width="100" height="30" stroke-width="2"></svg>
            </div>
          `,
        }
      },
      createdCell: (cell, data) => drawTrendline(cell, data, 7),
    },
  }
}

$(document).ready(async () => {
  const {
    data: projects,
    created_at: createdAt,
  } = await fetch('data/latest.min.json').then(r => r.json())

  const templateOSS = selectors.templateOSS(projects)

  document.querySelector('#built').innerHTML =
    `<strong>Last Built: ${date.format(createdAt)}</strong>`

  const columnsObj = {
    name: {
      title: 'Project',
      className: 'text-left',
      orderSequence: ['asc', 'desc'],
      render: (data, row) => {
        const names = selectors.names(row)
        const icons = [
          row.pkgUrl && EL.link({ class: 'icon icon-npm', href: row.pkgUrl, text: EL.npmIcon }),
          EL.link({ class: 'icon icon-github', href: row.url, text: EL.githubIcon }),
        ].filter(Boolean).join('')
        return {
          sort: names.sort,
          filter: names.filter,
          display: `<div class="project-cell">
            ${EL.link({ class: 'name', href: row.url, text: names.display })}
            <span class="icons">${icons}</span>
          </div>`,
        }
      },
    },
    'status.conclusion': {
      title: 'Status',
      render: (data, row) => {
        const opts = {
          success: {
            text: EL.icon('check-circle'),
            type: 'success',
            sort: 0,
          },
          failure: {
            text: EL.icon('x-circle'),
            type: 'danger',
            sort: 2,
          },
          neutral: {
            text: EL.icon('pause-circle'),
            type: 'info',
            sort: 1,
          },
        }[data] || {
          text: 'None',
          type: 'warning',
          sort: 3,
        }
        return {
          sort: opts.sort,
          display: EL.cell({ ...opts, href: row.status.url }),
        }
      },
    },
    ...renderIssues({ data: 'prs', title: 'PRs' }),
    ...renderIssues({ data: 'issues', title: 'Issues' }),
    ...renderIssues({ data: 'issues.noLabel', title: 'Unlabeled' }),
    ...renderIssues({ data: 'issues.priority', title: 'Priority' }),
    ...renderIssues({ data: 'issues.triage', title: 'Triage' }),
    version: {
      title: 'Version',
      type: 'num',
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        const type = !data ? 'danger' : semver.version.parse(data)[0] < 1 ? 'warning' : 'success'
        const text = data || NOPUB
        return {
          sort: data ? semver.version.score(data) : 0,
          filter: text,
          display: EL.cell({
            text,
            type,
            href: data && `${row.pkgUrl}/v/${data}`,
          }),
        }
      },
    },
    'pendingRelease.version': {
      title: 'Release',
      type: 'num',
      defaultContent: 0,
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        const opts = data ? {
          text: data,
          href: row.pendingRelease.url,
          type: 'warning',
        } : {
          text: 'None',
          type: 'success',
        }
        return {
          sort: data ? semver.version.score(data) : 0,
          filter: opts.text,
          display: EL.cell(opts),
        }
      },
    },
    templateVersion: {
      title: 'Template',
      type: 'num',
      render: (data) => {
        const type = !data ? 'danger' : data !== templateOSS.version ? 'warning' : 'success'
        const text = data || 'None'
        return {
          sort: data ? semver.version.score(data) : 0,
          filter: text,
          display: EL.cell({ text, type }),
        }
      },
    },
    coverage: {
      title: 'Coverage',
      type: 'num',
      render: (data) => {
        const type = !data ? 'danger' : data === 100 ? 'success' : 'warning'
        const text = data == null ? 'None' : data
        const sort = data == null ? -1 : data
        return {
          sort,
          filter: text,
          display: EL.cell({ text, type }),
        }
      },
    },
    node: {
      title: 'Node',
      type: 'num',
      render: (data) => {
        const templateData = semver.range.parse(templateOSS.node)
        const parsedData = semver.range.parse(data)
        const text = data || 'None'

        const type = parsedData[0][0] >= templateData[0][0]
          ? 'success'
          : parsedData[0][0] >= 10 ? 'warning'
          : 'danger'

        return {
          sort: semver.version.score(parsedData[0]),
          filter: text,
          display: EL.cell({ text, type }),
        }
      },
    },
    defaultBranch: {
      title: 'Branch',
      render: (data, row) => {
        const branches = {
          master: 'danger',
          latest: 'warning',
          main: 'success',
        }
        const type = branches[data] || 'warning'
        return {
          sort: Object.keys(branches).indexOf(data),
          filter: data,
          display: EL.cell({ text: data, type, href: `${row.url}/settings/branches` }),
        }
      },
    },
    license: {
      title: 'License',
      render: (data) => {
        return {
          display: EL.cell({ text: data || 'None', type: data ? 'success' : 'danger' }),
        }
      },
    },
    archived: {
      // archived and deprecated are excluded so if something is here
      // and it is archived then it needs to be deprecated
      title: 'Deprecate',
      type: 'num',
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        const opts = data ? { type: 'danger', text: 'TODO' } : { type: 'success', text: 'No' }
        return {
          sort: data ? 0 : 1,
          filter: opts.text,
          display: EL.cell(opts),
        }
      },
    },
    lastPublished: {
      title: 'Published',
      type: 'num',
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        const text = data ? date.format(data) : NOPUB
        return {
          sort: data ? Date.parse(data) : 0,
          filter: text,
          display: EL.cell({ text }),
        }
      },
    },
    'lastPush.date': {
      title: 'Commit',
      type: 'num',
      render: (data, row) => {
        const text = date.format(data)
        return {
          sort: Date.parse(data),
          filter: text,
          display: EL.cell({ text, href: row.lastPush.url }),
        }
      },
    },
    'stars.count': {
      title: 'Stars',
      type: 'num',
      defaultContent: 0,
      render: (data, row) => {
        if (selectors.isWorkspace(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        const text = numFormat(data)
        return {
          sort: data,
          filter: text,
          display: EL.cell({ text, href: row.stars.url }),
        }
      },
    },
    downloads: {
      title: 'Downloads(/mo)',
      type: 'num',
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        if (!selectors.isPublished(row)) {
          return {
            sort: 0,
            filter: NOPUB,
            display: EL.cell({ text: NOPUB }),
          }
        }
        return {
          sort: data,
          filter: data,
          display: numFormat(data),
        }
      },
    },
    size: {
      title: 'Size(KB)',
      type: 'num',
      render: (data, row) => {
        if (selectors.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        if (!selectors.isPublished(row) || data == null) {
          // some old packages have no size
          return {
            sort: 0,
            filter: NOPUB,
            display: EL.cell({ text: NOPUB }),
          }
        }
        return {
          sort: data,
          filter: data,
          display: numFormat(data),
        }
      },
    },
  }

  const columns = Object.entries(columnsObj)
  // Make the datatables api a little nicer for things that we want to do
  // to all the columns
    .map(([key, {
      render,
      type: colType,
      orderSequence = ['desc', 'asc'],
      ...column
    }]) => ({
      // the data key is now the name of the column
      data: key,
      name: key,
      type: colType,
      orderSequence,
      // use our special render function to avoid having to check
      // the type everywhere
      render: (data, type, ...args) => {
        const res = render(data, ...args)
        if (hasOwn(res, 'filter') && type === 'filter') {
          return res.filter
        }
        if (hasOwn(res, 'sort') && (type === 'sort' || type === 'type')) {
          // sort and type should always be the same. sort is the value
          // to sort by and type is the type that gets applied to the sorted value
          // if type is wrong then datatables gets very confused even if all
          // our sorted values are numbers
          return res.sort
        }
        if (hasOwn(res, 'display') && type === 'display') {
          return res.display
        }
        return data
      },
      ...column,
    }))

  const trendColumns = columns
    .filter((c) => c.name.endsWith('.history'))
    .map((c) => c.name)

  $.fn.dataTableExt.classes.sFilterInput = 'form-control'

  const $table = $('#statusboard')
    .append(`<tfoot><tr>${columns.map(() => `<th></th>`)}</tr></tfoot>`)
    .DataTable({
      data: projects,
      columns,
      rowId: 'id',
      paging: false,
      stateSave: true,
      deferRender: true,
      scrollX: true,
      dom: `<"controls"Bfi>rt`,
      responsive: true,
      language: {
        search: '',
        searchPlaceholder: 'Filter projects…',
      },
      footerCallback: function () {
        const dt = this.api()
        const totalsColumns = [
          'downloads',
          ...columns.filter((c) => c.name.endsWith('.count')).map(c => c.name),
        ]
        for (const name of totalsColumns) {
          const col = dt.column(`${name}:name`)
          col.footer().innerHTML = numFormat(col.data().sum())
        }
      },
      buttons: [
        {
          extend: 'colvis',
          text: 'Columns',
          columnText: (dt, idx, title) => `${EL.icon('check')} ${title}`,
          autoClose: true,
          fade: 0,
        },
        {
          text: 'Toggle Trends',
          action: (e, dt, node) => {
            const visibility = dt.column(`${trendColumns[0]}:name`).visible()
            node[0].classList.toggle('active', !visibility)
            for (const name of trendColumns) {
              dt.column(`${name}:name`).visible(!visibility)
              dt.column(`${name.replace('.history', '.count')}:name`).visible(visibility)
            }
          },
        },
        {
          extend: 'collection',
          text: 'Trend Dates',
          className: 'time-button-collection',
          autoClose: true,
          fade: 0,
          buttons: TREND_DAYS.map((days, i) => ({
            text: `<span>${EL.icon('check')} ${days} Days</span>`,
            className: i === 0 ? 'active' : '',
            action: (e, dt, node) => {
              $(node).siblings().removeClass('active')
              node[0].classList.add('active')
              trendColumns.forEach((col) => {
                projects.forEach((project) => {
                  const cell = dt.cell(`#${project.id}`, `${col}:name`)
                  drawTrendline(cell.node(), cell.data(), days)
                })
              })
            },
          })),
        },
      ],
    })

  // Always hide archived/deprecated column if there is no relevant data
  $table.column(`archived:name`).visible(!selectors.noArchived(projects))
})
