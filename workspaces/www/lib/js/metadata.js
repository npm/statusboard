
import * as EL from './html.js'
import * as util from './util.js'

const icon = (error) => error ? EL.icon('x-circle') : EL.icon('check-circle')

const getUrl = (id) => id ? `https://github.com/npm/statusboard/actions/runs/${id}` : null

const updateMetadata = (el, { 'fetch-data': fetchData, 'fetch-maintained': fetchMaintained }) => {
  const BUILD_CONTEXT = process.env.BUILD_CONTEXT
  const updateHTML = []

  if (BUILD_CONTEXT) {
    const { sha, date, id } = BUILD_CONTEXT
    updateHTML.push({
      type: 'dark',
      href: getUrl(id),
      text: `Deployed: ${util.date.fromNow(date)}`,
      title: `${date} - ${sha}`,
    })
  }

  if (fetchData) {
    const { success, error, id } = fetchData
    updateHTML.push({
      type: error ? 'danger' : 'success',
      href: getUrl(id),
      text: `Data: ${icon(error)} ${util.date.fromNow(success)}`,
      title: error || success,
    })
  }

  if (fetchMaintained) {
    const { success, error, id, update } = fetchMaintained
    const updateText = update ? `${Math.abs(update)} ${update > 0 ? 'added' : 'removed'} ` : ' '
    updateHTML.push({
      type: error ? 'danger' : 'success',
      href: getUrl(id),
      text: `Projects: ${icon(error)} ${updateText}${util.date.fromNow(success)}`,
      title: error || success,
    })
  }

  el.innerHTML = updateHTML.map(EL.badge).join(' ')
}

export default updateMetadata
