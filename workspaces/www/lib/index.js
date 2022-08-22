import $ from 'jquery'
import * as EL from './js/html.js'
import * as util from './js/util.js'
import * as $$ from './js/selectors.js'
import getColumns from './js/columns.js'
import getTrends from './js/trends.js'
import getData from './js/api.js'
import DataTable from './js/datatable.js'
import updateMetadata from './js/metadata.js'

DataTable($)
const TREND_OPTIONS = [7, 30, 90]

$(async () => {
  const { projects, metadata } = await getData()
  const columns = getColumns(projects, metadata)
  const trends = getTrends(projects, columns, { default: TREND_OPTIONS[0] })

  updateMetadata(document.querySelector('#built'), metadata)

  $.fn.dataTableExt.classes.sFilterInput = 'form-control'

  const $table = $('#statusboard')
    .append(`<tfoot><tr>${columns.map(() => `<th></th>`)}</tr></tfoot>`)
    .DataTable({
      data: projects,
      columns,
      rowId: $$.keys.id,
      paging: false,
      stateSave: true,
      scrollX: true,
      deferRender: true,
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
          ...columns.filter((c) => c.name.endsWith($$.keys.count)),
        ]
        for (const totalCol of totalsColumns) {
          const col = dt.column($$.colId(totalCol))
          col.footer().innerHTML = util.num.format(col.data().sum())
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
          ...trends.toggleButton(),
        },
        {
          extend: 'collection',
          text: 'Trend Dates',
          autoClose: true,
          fade: 0,
          buttons: TREND_OPTIONS.map((opt) => ({
            text: `<span>${EL.icon('check')} ${opt} Days</span>`,
            ...trends.dateButton(opt),
          })),
        },
      ],
      ...trends.config,
    })

  // do all the trends stuff
  trends.init($table)

  // Always hide archived/deprecated column if there is no relevant data
  $table
    .column(`archived:name`)
    .visible(!$$.noArchived(projects))
})
