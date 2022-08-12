import dataPath from '../data/latest.json'
import metadataPath from '../data/metadata.json'

export default async ({ fakeHistory } = {}) => {
  const [projects, metadata] = await Promise.all([
    fetch(dataPath).then(r => r.json()),
    fetch(metadataPath).then(r => r.json()),
  ])

  if (fakeHistory) {
    // just for visual testing
    projects.forEach((p) => {
      const rand = () => new Array(200).fill(0).map(() => +Math.random().toString().slice(2, 4))
      if (p.issues) {
        p.issues.history.unshift(...rand())
        p.issues.unlabeled.history.unshift(...rand())
        p.issues.priority.history.unshift(...rand())
        p.issues.triage.history.unshift(...rand())
        p.prs.history.unshift(...rand())
      }
    })
  }

  return { projects, metadata }
}
