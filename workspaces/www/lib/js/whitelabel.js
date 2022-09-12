
import * as EL from './html.js'

const whiteLabel = (el) => {
  const title = process.env.SITE_NAME || 'Statusboardify'
  const href = process.env.SITE_URL
  el.innerHTML = EL.title(title, href)
}

export default whiteLabel
