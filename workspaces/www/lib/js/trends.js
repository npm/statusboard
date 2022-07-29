import sparkline from './sparkline.js'
import * as util from './util.js'
import * as $$ from './selectors.js'

export const cell = {
  html: `
    <div class="trendline-container">
      <div class="trendline-data">
          <span class="trendline-date"></span>
          <span class="trendline-value"></span>
      </div>
      <svg class="sparkline" width="100" height="30" stroke-width="2"></svg>
    </div>
  `,
  draw: (cellNode, data, drawDays) => {
    const container = cellNode.querySelector('.trendline-container')

    if (!container) {
      // no container element means that the cell doesn't have that type of data
      // and it has already been rendered statically
      return
    }

    const trendlineDates = util.date.range(drawDays)
    const daysData = data.slice(drawDays * -1)
    const missingData = new Array(drawDays - daysData.length).fill(null)
    const fullData = [...missingData, ...daysData]

    const scrollBody = document.querySelector('.dataTables_scrollBody')
    const trendlineData = container.querySelector('.trendline-data')
    const trendlineDate = container.querySelector('.trendline-date')
    const trendlineValue = container.querySelector('.trendline-value')

    sparkline(
      container.querySelector('.sparkline'),
      fullData,
      {
        onmousemove: (e, { index, value }) => {
          scrollBody.classList.add('with-tooltip')
          trendlineData.classList.add('active')
          trendlineDate.innerHTML = trendlineDates[index]
          trendlineValue.innerHTML = index < missingData.length ? 'No Data' : value
        },
        onmouseout: () => {
          scrollBody.classList.remove('with-tooltip')
          trendlineData.classList.remove('active')
        },
      }
    )
  },
}

export default (rows, columns, { default: defaultDay }) => {
  // save instance of datatable so we dont need to pass it around
  let dt = null

  const trendColumns = columns.filter((c) => c.name.endsWith($$.keys.trend)).map(c => c.name)
  const isVisible = () => trendColumns.some((c) => dt.column($$.colId(c)).visible())

  const storage = {
    // Source of truth for the current number of trend days
    current: null,
    key: 'npm.TRENDS_DAYS',
    load: (defaultValue) => {
      const { [storage.key]: loaded } = dt.state.loaded() || {}
      storage.current = loaded || defaultValue
    },
    save: (days) => {
      storage.current = days
      dt.state.save()
      return days
    },
    onSave: (data) => {
      if (storage.current) {
        data[storage.key] = storage.current
      }
    },
  }

  const toggle = {
    key: 'npm_BTN_TRENDS_TOGGLE',
    buttonConfig: () => ({
      name: toggle.key,
      action: () => {
        const visible = isVisible()
        toggle.setState(!visible)
        toggle.render(!visible)
      },
    }),
    setState: (visible) => {
      const btn = dt.button(`${toggle.key}:name`)
      btn.node().toggleClass('active', visible)
    },
    render: (visible) => {
      for (const col of trendColumns) {
        // toggle trend columns
        dt.column($$.colId(col)).visible(visible)
        // toggle count columns to opposite of trends
        dt.column($$.colId(col.replace($$.keys.trend, $$.keys.count))).visible(!visible)
      }
    },
  }

  const dates = {
    key: 'npm_BTN_TRENDS_DAYS_',
    buttonConfig: (dayOpt) => ({
      name: dates.key + dayOpt,
      action: () => {
        storage.save(dayOpt)
        dates.render()
      },
    }),
    setState: () => {
      const toggleBtn = dt.button(`${dates.key}${storage.current}:name`).node()
      toggleBtn.siblings().removeClass('active')
      toggleBtn.addClass('active')
    },
    render: () => {
      dates.setState()
      trendColumns.forEach((col) => rows.forEach((row) => {
        const tableCell = dt.cell($$.rowId(row), $$.colId(col))
        cell.draw(tableCell.node(), tableCell.data(), storage.current)
      }))
    },
  }

  const init = (_dt) => {
    dt = _dt
    storage.load(defaultDay)
    toggle.setState(isVisible())
    dates.render()
  }

  return {
    toggleButton: toggle.buttonConfig,
    dateButton: dates.buttonConfig,
    init,
    config: {
      // stateLoadParams: (_, data) => storage.onLoad(data),
      stateSaveParams: (_, data) => storage.onSave(data),
    },
  }
}
