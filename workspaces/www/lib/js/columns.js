import * as $$ from './selectors.js'
import * as EL from './html.js'
import * as util from './util.js'
import * as trends from './trends.js'

const makeIssueColumns = ({ data: key, title, danger = 20, warning = 1 }) => ({
  [key + $$.keys.count]: {
    title: util.titleCase(title || key),
    defaultContent: 0,
    render: (data, row) => {
      if ($$.isWorkspace(row) && data == null) {
        return {
          sort: -1,
          display: EL.noData({ type: 'info' }),
        }
      }
      const type = data >= danger ? 'danger' : data >= warning ? 'warning' : 'success'
      const rowIssues = key.split('.').reduce((acc, k) => acc[k], row)
      return {
        sort: data,
        display: EL.cell({ text: util.num.format(data), type, href: rowIssues.url }),
      }
    },
  },
  [key + $$.keys.trend]: {
    title: util.titleCase(title || key),
    visible: false,
    type: 'num',
    defaultContent: 0,
    render: (data, row) => {
      if ($$.isWorkspace(row) && data == null) {
        return {
          sort: -1,
          display: EL.noData({ type: 'info' }),
        }
      }
      if (!data || data.length <= 1) {
        // sparkline needs more than one data point
        return {
          sort: 0,
          display: EL.noData({ text: 'No Data' }),
        }
      }
      return {
        sort: util.avg(data),
        display: trends.cell.html,
      }
    },
  },
})

const getColumns = (rows) => {
  const templateOSS = $$.templateOSS(rows)
  const requiredTemplate = $$.templateVersion(rows)
  const requiredNode = $$.nodeVersion(rows)

  const rowWithIssues = rows.find((project) => project.issues && project.prs) || {}

  const issueColumns = Object.entries(rowWithIssues).reduce((acc, [rowKey, rowValue]) => {
    if (rowKey === 'prs' || rowKey === 'issues') {
      Object.assign(acc, makeIssueColumns({ data: rowKey }))

      const countCols = Object.entries(rowValue).filter(([, v]) => v && Object.hasOwn(v, 'count'))
      for (const [colName] of countCols) {
        const countKey = `${rowKey}.${colName}`
        Object.assign(acc, makeIssueColumns({ data: countKey, title: colName }))
      }
    }
    return acc
  }, {})

  return {
    name: {
      title: 'Project',
      className: 'text-left',
      orderSequence: ['asc', 'desc'],
      render: (data, row) => {
        const names = $$.names(row)
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
    ...issueColumns,
    version: {
      title: 'Version',
      type: 'num',
      render: (data, row) => {
        if ($$.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData({ type: 'info' }),
          }
        }
        const hasUnpublished = data !== row.repoVersion ? row.repoVersion : ''
        const pendingRelease = row.prs?.release?.version
        const nextVersion = hasUnpublished || pendingRelease

        const type = !data ? 'danger'
          : util.semver.parse(data)[0] < 1 || nextVersion ? 'warning' : 'success'
        const text = data
          ? `${data}${nextVersion ? ` / ${nextVersion}` : ''}`
          : EL.notPublished

        return {
          sort: data ? util.semver.score(data) : 0,
          filter: text,
          display: EL.cell({
            text,
            type,
          }),
        }
      },
    },
    templateVersion: {
      title: 'Template',
      type: 'num',
      render: (data, row) => {
        if (data === null) {
          return {
            sort: -1,
            filter: 'N/A',
            display: EL.cell({ text: 'N/A', type: 'info' }),
          }
        }

        const isTemplateOSS = $$.rowId(row) === $$.rowId(templateOSS)
        const type = isTemplateOSS || data === requiredTemplate ? 'success'
          : data && data !== requiredTemplate ? 'warning'
          : 'danger'
        const version = isTemplateOSS ? requiredTemplate : data
        const text = version || 'None'
        return {
          sort: version ? util.semver.score(version) : 0,
          filter: text,
          display: EL.cell({ text, type }),
        }
      },
    },
    coverage: {
      title: 'Coverage',
      type: 'num',
      render: (data) => {
        if (data === null) {
          return {
            sort: -1,
            filter: 'N/A',
            display: EL.cell({ text: 'N/A', type: 'info' }),
          }
        }

        const type = !data ? 'danger' : data === 100 ? 'success' : 'warning'
        return {
          sort: data,
          filter: data,
          display: EL.cell({ text: data, type }),
        }
      },
    },
    node: {
      title: 'Node',
      type: 'num',
      render: (data) => {
        if (data === null) {
          return {
            sort: util.semver.rangeScore(data),
            filter: 'N/A',
            display: EL.cell({ text: 'N/A', type: 'info' }),
          }
        }

        const text = data ? data === requiredNode ? 'Default' : data : 'None'
        const type = !data || !requiredNode ? 'danger'
          : data === requiredNode ? 'success'
          : util.semver.subset(data, requiredNode) ? 'info'
          : util.semver.subset(data, '>=10') ? 'warning'
          : 'danger'

        return {
          sort: util.semver.rangeScore(data),
          filter: text,
          display: EL.cell({ text, type }),
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
        if ($$.isPrivate(row)) {
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
        if ($$.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        const text = data ? util.date.format(data) : EL.notPublished
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
        const text = util.date.format(data)
        return {
          sort: Date.parse(data),
          filter: text,
          display: EL.cell({ text, href: row.lastPush.url }),
        }
      },
    },
    ['stars' + $$.keys.count]: {
      title: 'Stars',
      type: 'num',
      defaultContent: 0,
      render: (data, row) => {
        if ($$.isWorkspace(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        const text = util.num.format(data)
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
        if ($$.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        if (!$$.isPublished(row)) {
          return {
            sort: 0,
            filter: EL.notPublished,
            display: EL.cell({ text: EL.notPublished }),
          }
        }
        return {
          sort: data,
          filter: data,
          display: util.num.format(data),
        }
      },
    },
    size: {
      title: 'Size(KB)',
      type: 'num',
      render: (data, row) => {
        if ($$.isPrivate(row)) {
          return {
            sort: -1,
            display: EL.noData(),
          }
        }
        if (!$$.isPublished(row) || data == null) {
        // some old packages have no size
          return {
            sort: 0,
            filter: EL.notPublished,
            display: EL.cell({ text: EL.notPublished }),
          }
        }
        return {
          sort: data,
          filter: data,
          display: util.num.format(data),
        }
      },
    },
  }
}

export default (rows, meta) => Object.entries(getColumns(rows))
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
      const renderData = util.hasOwn($$.overrides, key) && $$.overrides[key](meta, data, ...args)
      const res = render(...(renderData || [data, ...args]))
      if (util.hasOwn(res, 'filter') && type === 'filter') {
        return res.filter
      }
      if (util.hasOwn(res, 'sort') && (type === 'sort' || type === 'type')) {
      // sort and type should always be the same. sort is the value
      // to sort by and type is the type that gets applied to the sorted value
      // if type is wrong then datatables gets very confused even if all
      // our sorted values are numbers
        return res.sort
      }
      if (util.hasOwn(res, 'display') && type === 'display') {
        return res.display
      }
      return data
    },
    ...column,
  }))
