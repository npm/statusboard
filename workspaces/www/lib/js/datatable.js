import DT from 'datatables.net'
import DTBS4 from 'datatables.net-bs4'
import DTButtons from 'datatables.net-buttons'
import DTButtonsBS4 from 'datatables.net-buttons-bs4'
import ColVis from 'datatables.net-buttons/js/buttons.colVis.js'

const sumPlugin = (_, $) => $.fn.dataTable.Api.register('sum()', function () {
  return this.flatten().reduce(function (a, b) {
    if (typeof a === 'string') {
      a = a.replace(/[^\d.-]/g, '') * 1
    }
    if (typeof b === 'string') {
      b = b.replace(/[^\d.-]/g, '') * 1
    }
    return a + b
  }, 0)
})

export default (jQuery) => {
  DT(window, jQuery)
  DTBS4(window, jQuery)
  DTButtons(window, jQuery)
  DTButtonsBS4(window, jQuery)
  ColVis(window, jQuery)
  sumPlugin(window, jQuery)
}
