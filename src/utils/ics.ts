type ICalEvent = {
  uid: string
  summary: string
  description?: string
  start: string
  end?: string
}

function formatDate(dt: string) {
  // YYYYMMDDTHHmmssZ
  const date = new Date(dt)
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function downloadICS(filename: string, events: ICalEvent[]) {
  if (!events.length) return
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Udar CRM//Tasks//EN',
  ]
  events.forEach((e) => {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${e.uid}`)
    lines.push(`SUMMARY:${e.summary}`)
    if (e.description) lines.push(`DESCRIPTION:${e.description}`)
    lines.push(`DTSTART:${formatDate(e.start)}`)
    if (e.end) lines.push(`DTEND:${formatDate(e.end)}`)
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


