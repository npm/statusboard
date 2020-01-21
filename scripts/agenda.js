(async function () {
  require('dotenv').config()
  const Octokit = require("@octokit/rest")
  const fetch = require('node-fetch')
  const octokit = new Octokit({ auth: process.env.AUTH_TOKEN })
  const now = new Date()
  const datetime = `${now.getFullYear()}-${(now.getMonth()+1)}-${now.getDate()}T10:00:00-07:00`
  const calendar = 'npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com'
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendar}/events?key=${process.env.CALENDAR_AUTH_TOKEN}&q="Open RFC"&timeMin=${datetime}&orderBy=starttime&singleEvents=true&maxResults=1`)
  const force = process.argv.indexOf('-f') || process.argv.indexOf('--force')
  let data = await response.json()
  let meeting = data.items[0]
  let start = new Date(meeting.start.dateTime)
  let options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }
  let diff = new Date(start - now)
  if (!force && (diff.getUTCDate() - 1) <= 6) {
    console.error('Error: Agenda should exist already!')
    return
  }
  let formatted = new Intl.DateTimeFormat('en-US', options).format(start)
  octokit.search.issuesAndPullRequests({ q: `label:"Agenda"+org:"npm"` }).then(response => {
    let items = []
    response.data.items.forEach(i => {
      items.push(`1. **${i.pull_request ? 'PR' : 'Issue'}**: [#${i.number} ${i.title}](${i.html_url})`)
    })
    const body = `
## When?
**${formatted} EST**

> **Note:** This meeting is scheduled to take place bi-weekly. Previous meeting agendas and notes can be found [here](https://github.com/npm/rfcs/issues?q=is%3Aissue+sort%3Aupdated-desc+is%3Aclosed+label%3Ameeting)

## What?

1. Housekeeping (introductions, outlining intentions & desired outcomes)
${items.join('\n')}

## How?

**Join Zoom Meeting**
https://npm.zoom.us/j/584504445

**Dial by your location**
+1 669 900 6833 US (San Jose)
+1 646 558 8656 US (New York)

**Meeting ID:** 584 504 445
Find your local number: https://zoom.us/u/abR8OFljr8

**Add to your Calendar**
You add this and all other public npm events with the following link:
https://calendar.google.com/calendar/embed?src=npmjs.com_oonluqt8oftrt0vmgrfbg6q6go%40group.calendar.google.com

**Watch the livestream**
https://www.youtube.com/channel/UCK71Wk0I45SLTSXQA23GdIw/videos
    `
    octokit.issues.create({
      owner: 'npm',
      repo: 'rfcs',
      title: `Open RFC Meeting - ${formatted} EST`,
      body: body,
      labels: ['Agenda', 'Meeting'],
      assignees: ['darcyclarke']
    })
  })
})()
