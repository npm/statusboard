/* globals $, sparkline */

const EL = {
  // eslint-disable-next-line max-len
  githubIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`,
  // eslint-disable-next-line max-len
  npmIcon: `<svg viewBox="0 0 27.23 27.23"><rect width="27.23" height="27.23" rx="2"></rect><polygon fill="#fff" points="5.8 21.75 13.66 21.75 13.67 9.98 17.59 9.98 17.58 21.76 21.51 21.76 21.52 6.06 5.82 6.04 5.8 21.75"></polygon></svg>`,
  check: (text) => `<i class="bi bi-check"></i> ${text}`,
  link: ({ class: className = '', href, text }) =>
    `<a href="${href}" class="${className}">${text}</a>`,
  badge: ({ type, href, text }) => {
    const classes = `badge badge-dt badge-${type}`
    return href ? EL.link({ class: classes, href, text }) : `<div class="${classes}">${text}</div>`
  },
  noData: (opts) => EL.badge({ text: 'N/A', ...opts }),
  cell: (opts) => opts.type ? EL.badge(opts) : opts.href ? EL.link(opts) : opts.text,
}

const cleanSemver = (d = '') => d.replace(/\s/g, '').replace(/(\d)\.0\.0/g, '$1')
const dateFormat = (...args) => new Intl.DateTimeFormat('en').format(...args)
const numFormat = (...args) => new Intl.NumberFormat('en-US').format(...args)

const getDateRange = (days) => {
  const DAY = 24 * 60 * 60 * 1000
  const range = [new Date()]
  for (let i = 1; i < days; i++) {
    range.push(new Date(range[0] - i * DAY))
  }
  return range.reverse().map((d) => dateFormat(d))
}

const renderNumber = (getOpts = () => {}) => ({
  allowNull: true,
  renderDisplay: (data, row) => EL.cell({ text: numFormat(data), ...getOpts(data, row) }),
})

let TREND_DAYS = 7

const validTrendline = (data) => data && !data.every(d => d === 0)

const renderTrendline = (days = TREND_DAYS) => ({
  allowNull: true,
  visible: false,
  createdCell: (cell, data) => drawTrendliine(cell, data, days),
  renderDisplay: (data) => validTrendline(data) ? `        
    <div class="trendline-container">
      <div class="trendline-data">
          <span class="trendline-date"></span>
          <span class="trendline-value"></span>
      </div>
      <svg class="sparkline" width="100" height="30" stroke-width="2"></svg>
    </div>
  ` : EL.noData(),
})

const drawTrendliine = (cell, data, days) => {
  TREND_DAYS = days

  const container = cell.querySelector('.trendline-container')
  if (!container) {
    return
  }

  const trendlineDates = getDateRange(days)
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

$(document).ready(async () => {
  const API_DATA = await fetch('data/latest.min.json').then(r => r.json())
  const DATA = Object.values(API_DATA.data)
  const templateOSS = DATA.find((p) => p.name === 'template-oss')

  document.querySelector('#built').innerHTML =
    `<strong>Last Built: ${dateFormat(new Date(API_DATA.created_at))}</strong>`

  const columnsObj = {
    name: {
      title: 'Project',
      className: 'text-left',
      renderSort: (data, row) => row.path ? row.pkgName : data,
      renderFilter: (data, row) => [data, row.pkgName],
      renderDisplay: (data, row) => {
        const name = row.path ? row.pkgName : data
        const icons = [
          row.pkgUrl && EL.link({ class: 'icon icon-npm', href: row.pkgUrl, text: EL.npmIcon }),
          EL.link({ class: 'icon icon-github', href: row.url, text: EL.githubIcon }),
        ].filter(Boolean).join('')
        return `<div class="project-cell">
          ${EL.link({ class: 'name', href: row.url, text: name })}
          <span class="icons">${icons}</span>
        </div>`
      },
    },
    'status.conclusion': {
      title: 'Status',
      renderDisplay: (data, row) => {
        const opts = {
          success: {
            text: '✔',
            type: 'success',
          },
          failure: {
            text: 'X',
            type: 'danger',
          },
          neutral: {
            text: 'Neutral',
            type: 'info',
          },
        }[data] || {
          text: 'None',
          type: 'warning',
        }
        return EL.badge({ ...opts, href: row.status.url })
      },
    },
    'prs.count': {
      title: 'PRs',
      ...renderNumber((data, row) => ({
        type: data >= 20 ? 'danger' : data >= 1 ? 'warning' : 'success',
        href: row.prs.url,
      })),
    },
    'prs.history': {
      title: 'PRs',
      ...renderTrendline(),
    },
    'issues.count': {
      title: 'Issues',
      ...renderNumber((data, row) => ({
        type: data >= 20 ? 'danger' : data >= 1 ? 'warning' : 'success',
        href: row.issues.url,
      })),
    },
    'issues.history': {
      title: 'Issues',
      ...renderTrendline(),
    },
    'issues.noLabel.count': {
      title: 'No Labels',
      ...renderNumber((data, row) => ({
        type: data >= 20 ? 'danger' : data >= 1 ? 'warning' : 'success',
        href: row.issues.noLabel.url,
      })),
    },
    'issues.noLabel.history': {
      title: 'No Labels',
      ...renderTrendline(),
    },
    'issues.priority.count': {
      title: 'Priority',
      ...renderNumber((data, row) => ({
        type: data >= 20 ? 'danger' : data >= 1 ? 'warning' : 'success',
        href: row.issues.priority.url,
      })),
    },
    'issues.priority.history': {
      title: 'Priority',
      ...renderTrendline(),
    },
    'issues.triage.count': {
      title: 'Triage',
      ...renderNumber((data, row) => ({
        type: data >= 20 ? 'danger' : data >= 1 ? 'warning' : 'success',
        href: row.issues.triage.url,
      })),
    },
    'issues.triage.history': {
      title: 'Triage',
      ...renderTrendline(),
    },
    templateVersion: {
      title: 'Template',
      renderDisplay: (data) => {
        const type = !data ? 'danger' : data !== templateOSS.version ? 'warning' : 'success'
        return EL.badge({ text: data || 'None', type })
      },
    },
    coverage: {
      title: 'Coverage',
      renderDisplay: (data) => {
        const type = !data ? 'danger' : data === 100 ? 'success' : 'warning'
        return EL.badge({ text: typeof data === 'number' ? data : 'None', type })
      },
    },
    node: {
      title: 'Node',
      renderDisplay: (data) => {
        const cleanData = cleanSemver(data || '')
        const type = [cleanSemver(templateOSS.node), '>=18', '>=16'].includes(cleanData)
          ? 'success'
          : ['>=14', '>=12', '>=10'].includes(cleanData) ? 'warning'
          : 'danger'
        return EL.badge({ text: data || 'None', type })
      },
    },
    defaultBranch: {
      title: 'Branch',
      renderSort: (data) => ['main', 'latest', 'master'].indexOf(data),
      renderDisplay: (data, row) => {
        const type = {
          master: 'danger',
          latest: 'warning',
          main: 'success',
        }[data] || 'info'
        return EL.badge({ text: data, type, href: `${row.url}/settings/branches` })
      },
    },
    version: {
      title: 'Version',
      renderDisplay: (data, row) => {
        if (row.pkgPrivate) {
          return EL.noData()
        }
        const type = !data ? 'danger' : +data.split('.')[0] < 1 ? 'warning' : 'success'
        return EL.badge({
          text: data || 'Unpublished',
          type,
          href: data && `${row.pkgUrl}/v/${data}`,
        })
      },
    },
    license: {
      title: 'License',
      renderDisplay: (data) => {
        const type = data ? 'success' : 'danger'
        return EL.badge({ text: data || 'None', type })
      },
    },
    'pendingRelease.version': {
      title: 'Release',
      allowNull: true,
      renderDisplay: (data, row) => {
        if (row.pkgPrivate) {
          return EL.noData()
        }
        const opts = data ? {
          text: data,
          href: row.pendingRelease.url,
          type: 'warning',
        } : {
          text: 'None',
          type: 'success',
        }
        return EL.badge(opts)
      },
    },
    archived: {
      // archived and deprecated are excluded so if something is here
      // and it is archived then it needs to be deprecated
      title: 'Deprecate',
      renderDisplay: (data) => {
        return data ? EL.badge({ type: 'danger', text: 'TODO' }) : EL.noData()
      },
    },
    lastPublished: {
      title: 'Published',
      renderDisplay: (data, row) => {
        if (row.pkgPrivate) {
          return EL.noData()
        }
        return data ? dateFormat(new Date(data)) : 'Unpublished'
      },
    },
    'lastPush.date': {
      title: 'Commit',
      renderDisplay: (data, row) => {
        return EL.link({ text: dateFormat(new Date(data)), href: row.lastPush.url })
      },
    },
    'stars.count': {
      title: 'Stars',
      ...renderNumber((data, row) => ({
        href: row.stars.url,
      })),
    },
    downloads: {
      title: 'Downloads(/mo)',
      ...renderNumber(),
    },
    size: {
      title: 'Size(KB)',
      ...renderNumber(),
    },
  }

  const columns = Object.entries(columnsObj)
  // Make the datatables api a little nicer for things that we want to do
  // to all the columns
    .map(([dataKey, { renderDisplay, renderSort, renderFilter, allowNull, ...column }]) => ({
      ...column,
      // the data key is now the name of the column
      data: dataKey,
      name: dataKey,
      // allow null means that this column might be ok to not have this data
      // such as downloads/version on a repo only or issues on a workspace
      ...(allowNull ? { defaultContent: '' } : {}),
      // datatable rendering is used for sorting, filtering and display
      render: (data, type, ...args) => {
      // allow differentiated sorting
        if (type === 'sort' && renderSort) {
          return renderSort(data, ...args)
        }

        // allow differentiated filtering
        if (type === 'filter' && renderFilter) {
          return renderFilter(data, ...args)
        }

        // if there's only a render data function use that for both
        // display and filtering
        if (type === 'display' && renderDisplay) {
          if (allowNull && data == null) {
            return EL.noData()
          }
          return renderDisplay(data, ...args)
        }

        // default to just raw data for everything else
        // cells should use the raw data property
        return data
      },
    }))

  const trendColumns = columns
    .filter((c) => c.name.endsWith('.history'))
    .map((c) => c.name)

  $.fn.dataTableExt.classes.sFilterInput = 'form-control'

  $('#statusboard')
    .append(`<tfoot><tr>${columns.map(() => `<th></th>`)}</tr></tfoot>`)
    .DataTable({
      data: DATA,
      columns,
      rowId: 'id',
      paging: false,
      stateSave: true,
      deferRender: true,
      scrollX: true,
      dom: `<"controls"Bf>rtip`,
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
          columnText: (dt, idx, title) => EL.check(title),
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
          buttons: [TREND_DAYS, 30, 90].map((d) => ({
            text: `<span>${EL.check(`${d} Days`)}</span>`,
            className: TREND_DAYS === d ? 'active' : '',
            action: (e, dt, node) => {
              $(node).siblings().removeClass('active')
              node[0].classList.add('active')
              trendColumns.forEach((col) => {
                DATA.forEach((project) => {
                  const cell = dt.cell(`#${project.id}`, `${col}:name`)
                  drawTrendliine(cell.node(), cell.data(), d)
                })
              })
            },
          })),
        },
      ],
    })
})
