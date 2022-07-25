/* eslint-disable no-sequences, camelcase, max-len */
/* globals $, sparkline */

const EL = {
  githubIcon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`,
  npmIcon: `<svg viewBox="0 0 27.23 27.23"><rect width="27.23" height="27.23" rx="2"></rect><polygon fill="#fff" points="5.8 21.75 13.66 21.75 13.67 9.98 17.59 9.98 17.58 21.76 21.51 21.76 21.52 6.06 5.82 6.04 5.8 21.75"></polygon></svg>`,
  noData: `<div class="badge badge-light badge-dt">N/A</div>`,
  link: ({ class: className = 'text-primary', href, text }) => `<a href="${href}" target="_blank" class="${className}">${text}</a>`,
  badge: ({ type, href, text }) => {
    const classes = `badge badge-dt badge-${type}`
    return href ? EL.link({ class: classes, href, text }) : `<div class="${classes}">${text}</div>`
  },
  trendline: (row) => `        
    <div id="trendlineContainer${row.id}" class="trendline-container">
      <div class="trendline-data">
          <span id="trendlineDate${row.id}" class="trendline-date"></span>
          <span id="trendlineValue${row.id}" class="trendline-value"></span>
      </div>
      <svg id="issuesTrendline${row.id}" class="sparkline" width="100" height="40" stroke-width="3"></svg>
    </div>
  `,
}

const getDateRangeList = (days, start = new Date()) => {
  const DAY = 24 * 60 * 60 * 1000
  const range = [start]
  for (let i = 1; i < days; i++) {
    range.push(new Date(start - i * DAY))
  }
  return range.reverse()
}

const toDisplayDate = (d) =>
  `${zeroPad(d.getUTCMonth() + 1)}/${d.getUTCDate()}/${zeroPad(
    d.getUTCFullYear()
  )}`

const zeroPad = (n) => (n >= 10 ? n : `0${n}`)
const cleanSemver = (d) => d.replace(/\s/g, '').replace(/(\d)\.0\.0/g, '$1')

$(document).ready(async function () {
  const API_DATA = await fetch('data/latest.min.json').then(r => r.json())

  const latestDate = new Date(API_DATA.created_at)
  const datasource = Object.values(API_DATA.data)
  const dataById = API_DATA.data.reduce((acc, repo) => (acc[repo.id] = repo, acc), {})

  console.log(dataById)

  const TRENDLINE_DAYS = 7

  $('#built').html(
    `<strong>Last Built: ${new Intl.DateTimeFormat('en').format(latestDate)}</strong>`
  )

  // All columns are referenced by their data property
  // which gets copies to the `name` property used by
  // the datatables plugin.

  // // Columns with trend lines
  // const trendColumns = [
  //   'issue_list_by_date',
  //   'no_label_issues_by_date',
  //   'high_priority_issues_by_date',
  //   'needs_triage_issues_by_date',
  // ]

  // Columns with a total in the footer
  const totalsColumns = [
    'issues.count',
    'issues.noLabel.count',
    'issues.priority.count',
    'issues.triage.count',
    'prs.count',
    'downloads',
  ]

  // Columns that are the "main" columns for day to day rtb
  const mainColumns = [
    'status',
    'prs.count',
    'issues.count',
    'issues.noLabel.count',
    'issues.priority.count',
    'issues.triage.count',
  ]

  const $table = $('table').DataTable({
    data: datasource,
    footerCallback: function () {
      const api = this.api()
      for (const name of totalsColumns) {
        const num = Number(api.column(`${name}:name`, { page: 'current' }).data().sum()).toLocaleString()
        $(api.column(`${name}:name`).footer()).html(`${num}`)
      }
    },
    columns: [
      {
        data: 'name',
        title: 'Project',
        className: 'text-left project',
        renderData: (data, row) => {
          const name = row.pkgName || data
          return [
            EL.link({ href: row.url, text: name }),
            EL.link({ class: 'icon-github', href: row.url, text: EL.githubIcon }),
            row.pkgUrl ? EL.link({ class: 'icon-npm', href: row.pkgUrl, text: EL.npmIcon }) : '',
          ].join('')
        },
      },
      {
        data: 'status',
        title: 'Check Status',
        renderData: (data) => {
          if (!data) {
            return EL.noData
          }
          const opts = {}
          if (data.conclusion === 'success') {
            opts.text = 'Passing'
            opts.type = 'success'
          } else if (data.conclusion === 'failure') {
            opts.text = 'Failing'
            opts.type = 'danger'
          } else {
            opts.text = 'None'
            opts.type = 'warning'
          }
          return EL.badge({ ...opts, href: data.url })
        },
      },
      {
        data: 'prs.count',
        title: 'Pull Requests',
        defaultContent: EL.noData,
        renderData: (data, row) => {
          if (!row.prs) {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          const className = (data >= 20) ? 'danger' : (data >= 1) ? 'warning' : 'success'
          return EL.badge({ text: num, type: className, href: row.prs.url })
        },
      },
      {
        data: 'issues.count',
        title: 'Issues',
        defaultContent: EL.noData,
        renderData: (data, row) => {
          if (!row.issues) {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          const className = (data >= 20) ? 'danger' : (data >= 1) ? 'warning' : 'success'
          return EL.badge({ text: num, type: className, href: row.issues.url })
        },
      },
      // {
      //   data: 'issue_list_by_date',
      //   title: 'Issues Trend',
      //   defaultContent: '',
      //   renderData: (data, row) => {
      //     \n
      //       return EL.trendline(row)
      //     }
      //     return data
      //   },
      // },
      {
        data: 'issues.noLabel.count',
        title: 'No Labels',
        defaultContent: EL.noData,
        renderData: (data, row) => {
          if (!row.issues) {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          const className = (data >= 20) ? 'danger' : (data >= 1) ? 'warning' : 'success'
          return EL.badge({ text: num, type: className, href: row.issues.noLabel.url })
        },
      },
      // {
      //   data: 'no_label_issues_by_date',
      //   title: 'No Labels Trend',
      //   defaultContent: '',
      //   renderData: (data, row) => {
      //
      //       return EL.trendline(row)
      //     }
      //     return data
      //   },
      // },
      {
        data: 'issues.priority.count',
        title: 'High Priority',
        defaultContent: EL.noData,
        renderData: (data, row) => {
          if (!row.issues) {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          const className = (data >= 20) ? 'danger' : (data >= 1) ? 'warning' : 'success'
          return EL.badge({ text: num, type: className, href: row.issues.priority.url })
        },
      },
      // {
      //   data: 'high_priority_issues_by_date',
      //   title: 'High Priority Trend',
      //   defaultContent: '',
      //   renderData: (data, row) => {
      //
      //       return EL.trendline(row)
      //     }
      //     return data
      //   },
      // },
      {
        data: 'issues.triage.count',
        title: 'Needs Triage',
        defaultContent: EL.noData,
        renderData: (data, row) => {
          if (!row.issues) {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          const className = (data >= 20) ? 'danger' : (data >= 1) ? 'warning' : 'success'
          return EL.badge({ text: num, type: className, href: row.issues.triage.url })
        },
      },
      // {
      //   data: 'needs_triage_issues_by_date',
      //   title: 'Needs Triage Trend',
      //   defaultContent: '',
      //   renderData: (data, row) => {
      //
      //       return EL.trendline(row)
      //     }
      //     return data
      //   },
      // },
      {
        data: 'templateVersion',
        title: 'Template Version',
        renderData: (data) => {
          let className = ''
          if (!data) {
            data = 'None'
            className = 'danger'
          } else {
            className = data === dataById['npm/template-oss'].version ? 'success' : 'warning'
          }
          return EL.badge({ text: data, type: className })
        },
      },
      {
        data: 'coverage',
        title: 'Coverage',
        renderData: (data) => {
          let className = ''
          if (typeof data !== 'number') {
            data = 'None'
            className = 'danger'
          } else if (data === 100) {
            className = 'success'
          } else if (data > 0) {
            className = 'warning'
          } else {
            className = 'danger'
          }
          return EL.badge({ text: data, type: className })
        },
      },
      {
        data: 'node',
        title: 'Node Version',
        renderData: (data) => {
          let className = ''
          if (!data) {
            data = 'None'
            className = 'danger'
          } else {
            const latestEngines = cleanSemver(dataById['npm/template-oss'].node)
            const cleanData = cleanSemver(data)
            if (cleanData === latestEngines || cleanData === '>=18') {
              className = 'success'
            } else if (cleanData === '>=10') {
              className = 'warning'
            } else {
              className = 'danger'
            }
          }
          return EL.badge({ text: data, type: className })
        },
      },
      {
        data: 'defaultBranch',
        title: 'Branch',
        renderData: (data, row) => {
          let className = ''
          if (data === 'master') {
            className = 'danger'
          } else if (data === 'latest') {
            className = 'warning'
          } else if (data === 'main') {
            className = 'success'
          } else {
            className = 'info'
          }
          return EL.badge({ text: data, type: className, href: `${row.url}/settings/branches` })
        },
        renderSort: (data) => {
          return data === 'main' ? 0
            : data === 'latest' ? 1
            : data === 'master' ? 2
            : 3
        },
      },
      {
        data: 'version',
        title: 'Version',
        renderData: (data, row) => {
          if (row.pkgPrivate) {
            return EL.noData
          }
          let className = ''
          if (!data) {
            data = 'Unpublished'
            className = 'danger'
          } else {
            className = data.split('.')[0] >= 1 ? 'success' : 'danger'
          }
          return EL.badge({ text: data, type: className, href: `${row.pkgUrl}/v/${data}` })
        },
      },
      {
        data: 'license',
        title: 'License',
        renderData: (data, row) => {
          const className = data ? 'success' : 'danger'
          return EL.badge({ text: !data ? 'None' : data, type: className })
        },
      },
      {
        data: 'pendingRelease',
        title: 'Pending Release',
        renderData: (data, row) => {
          if (row.isPrivate) {
            return EL.noData
          }
          const opts = {}
          if (data) {
            opts.href = data.url
            opts.type = 'warning'
            opts.text = data.title
            data = data.title
          } else {
            opts.type = 'success'
            opts.text = 'None'
          }
          return EL.badge(opts)
        },
      },
      {
        data: 'lastPublished',
        title: 'Last Publish',
        renderData: (data, row) => {
          if (row.pkgPrivate) {
            return EL.noData
          }
          if (!data) {
            return EL.badge({ text: 'Unpublished', type: 'danger' })
          }
          return data
        },
      },
      {
        data: 'lastPush',
        title: 'Last Commit',
        renderData: (data) => {
          return EL.link({ text: data.date, href: data.url })
        },
      },
      {
        data: 'stars',
        title: 'Stars',
        renderData: (data, row) => {
          if (typeof data !== 'number') {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          return EL.link({ text: num, href: `${row.url}/stargazers` })
        },
      },
      {
        data: 'downloads',
        title: 'Downloads (/m)',
        renderData: (data, row) => {
          if (typeof data !== 'number') {
            return EL.noData
          }
          const num = Intl.NumberFormat('en-US').format(data)
          return EL.link({ text: num, href: row.pkgUrl })
        },
      },
      {
        data: 'size',
        title: 'Size (KB)',
        renderData: (data, row) => {
          return Intl.NumberFormat('en-US').format(data)
        },
      },
    ].map(({ renderData, renderSort, ...column }) => ({
      ...column,
      name: column.data,
      render: (data, type, ...args) => {
        if ((type === 'display' || type === 'filter') && renderData) {
          return renderData(data, ...args)
        }
        if (type === 'sort' && renderSort) {
          return renderSort(data, ...args)
        }
        return data
      },
    })),
    paging: false,
    colReorder: true,
    stateSave: true,
    deferRender: true,
    scrollX: true,
    dom: `<"controls"Bf>rtip`,
    responsive: true,
    language: {
      search: 'Filter Projects:',
      searchPlaceholder: 'Search...',
    },
    buttons: [
      {
        extend: 'colvis',
        columnText: (dt, idx, title) => `<i class="bi bi-check"></i> ${title}`,
      },
      {
        text: 'Toggle Main',
        action: (e, dt) => {
          const visibility = dt.column(`${mainColumns[0]}:name`).visible()
          for (const name of mainColumns) {
            const current = dt.column(`${name}:name`)
            current.visible(!visibility)
          }
          // if (visibility) {
          //   for (const name of trendColumns) {
          //     const current = dt.column(`${name}:name`)
          //     current.visible(false)
          //   }
          // }
        },
      },
      // {
      //   text: 'Toggle Trendlines',
      //   action: function (e, dt) {
      //     const visibility = dt.column(`${trendColumns[0]}:name`).visible()
      //     for (const name of trendColumns) {
      //       const current = dt.column(`${name}:name`)
      //       current.visible(!visibility)
      //     }
      //   },
      // },
      // {
      //   extend: 'collection',
      //   text: 'Trend Date Ranges',
      //   className: 'time-button-collection',
      //   buttons: [
      //     {
      //       text: `<span><i class="bi bi-check"></i> 7 Days</span>`,
      //       action: function (e, dt, node, config) {
      //         const $el = $(node)
      //         $el.siblings().removeClass('active')
      //         $el.addClass('active')
      //         TRENDLINE_DAYS = 7
      //       },
      //       className: 'active',
      //     },
      //     {
      //       text: `<span><i class="bi bi-check"></i> 30 Days</span>`,
      //       action: function (e, dt, node, config) {
      //         const $el = $(node)
      //         $el.siblings().removeClass('active')
      //         $el.addClass('active')
      //         TRENDLINE_DAYS = 30
      //       },
      //     },
      //     {
      //       text: `<span><i class="bi bi-check"></i> 90 Days</span>`,
      //       action: function (e, dt, node, config) {
      //         const $el = $(node)
      //         $el.siblings().removeClass('active')
      //         $el.addClass('active')
      //         TRENDLINE_DAYS = 90
      //       },
      //     },
      //   ],
      // },
    ],
  })

  // for (const name of trendColumns) {
  //   $table.column(`${name}:name`).visible(false)
  // }

  // $table.on(
  //   'column-visibility.dt',
  //   () => datasource.forEach((repo) => drawTrendline(repo))
  // ).on(
  //   'column-reorder',
  //   () => datasource.forEach((repo) => drawTrendline(repo))
  // )

  // const drawTrendline = (repo) => {
  //   const trendlineDates = getDateRangeList(TRENDLINE_DAYS).map(toDisplayDate)

  //   const elements = [
  //     { id: '#issuesTrendline', data: repo.issues.history },
  //     { id: '#highPrioIssues', data: repo.issues.priority.history },
  //     { id: '#needsTriageIssues', data: repo.issues.triage.history },
  //     { id: '#noLabelIssues', data: repo.issues.noLabel.history },
  //   ]

  //   elements.forEach(({ id, data }) => {
  //     const el = document.querySelector(id + repo.id)
  //     if (el) {
  //       sparkline.sparkline(
  //         el,
  //         data.slice(TRENDLINE_DAYS * -1),
  //         {
  //           onmousemove: function (e, datapoint) {
  //             const elId = `trendlineContainer${repo.id}`
  //             let $el = $(document.querySelector(`#${elId}`))
  //             $(document.querySelector('.dataTables_scrollBody')).addClass(
  //               'with-tooltip'
  //             )
  //             $el = $el.find('.trendline-data')
  //             $el.addClass('active')
  //             $el
  //               .find(`#trendlineDate${repo.id}`)
  //               .html(trendlineDates[datapoint.index])
  //             $el
  //               .find(`#trendlineValue${repo.id}`)
  //               .html(`${datapoint.value} Issues`)
  //           },
  //           onmouseout: function () {
  //             const elId = `trendlineContainer${repo.id}`
  //             const $el = $(document.querySelector(`#${elId}`))
  //             $(
  //               document.querySelector('.dataTables_scrollBody')
  //             ).removeClass('with-tooltip')
  //             $el.find('.trendline-data').removeClass('active')
  //           },
  //         }
  //       )
  //     }
  //   })
  // }
})
