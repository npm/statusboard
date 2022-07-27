import data from '../data/latest.json'

export default async ({ generateHistory } = {}) => {
  const { data: projects, created_at: createdAt } = await fetch(data).then(r => r.json())

  if (generateHistory) {
    // just for visual testing
    projects.forEach((p) => {
      const rand = () => new Array(200).fill(0).map(() => +Math.random().toString().slice(2, 4))
      if (p.issues) {
        p.issues.history.unshift(...rand())
        p.issues.noLabel.history.unshift(...rand())
        p.issues.priority.history.unshift(...rand())
        p.issues.triage.history.unshift(...rand())
        p.prs.history.unshift(...rand())
      }
    })
  }

  return {
    projects,
    createdAt,
  }
}
