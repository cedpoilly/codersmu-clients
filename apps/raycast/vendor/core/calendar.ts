import type { Meetup } from './types'

function joinParts(parts: Array<string | undefined | null>): string {
  const seen = new Set<string>()
  const cleaned = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })

  return cleaned.join(', ')
}

export function buildCalendarUrls(meetup: Meetup): { google: string, outlook: string } {
  const title = encodeURIComponent(meetup.title)
  const detailsSource = meetup.links.meetup
    ? `${meetup.summary}\n\nMore details: ${meetup.links.meetup}`
    : meetup.summary
  const details = encodeURIComponent(detailsSource)
  const location = encodeURIComponent(joinParts([meetup.location.name, meetup.location.address, meetup.location.city]))
  const start = meetup.startsAt.replace(/[-:]/g, '').replace('.000', '')
  const end = meetup.endsAt.replace(/[-:]/g, '').replace('.000', '')

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(meetup.startsAt)}&enddt=${encodeURIComponent(meetup.endsAt)}&body=${details}&location=${location}`,
  }
}

export function buildIcs(meetup: Meetup): string {
  const escape = (value: string): string => value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n')

  const toUtcStamp = (value: string): string =>
    new Date(value).toISOString().replace(/[-:]/g, '').replace('.000', '')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//coders.mu//Clients//EN',
    'BEGIN:VEVENT',
    `UID:${meetup.id}@coders.mu`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(meetup.startsAt)}`,
    `DTEND:${toUtcStamp(meetup.endsAt)}`,
    `SUMMARY:${escape(meetup.title)}`,
    `DESCRIPTION:${escape(meetup.links.meetup ? `${meetup.summary}\n\nMore details: ${meetup.links.meetup}` : meetup.summary)}`,
    `LOCATION:${escape(joinParts([meetup.location.name, meetup.location.address, meetup.location.city]))}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
