import { getMeetupEndsAt, getMeetupLinks, getMeetupLocationParts, getMeetupSlug, getMeetupStartsAt, getMeetupSummary } from './meetup-derived'
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
  const links = getMeetupLinks(meetup)
  const summary = getMeetupSummary(meetup)
  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)
  const locationParts = getMeetupLocationParts(meetup)

  if (!startsAt || !endsAt) {
    throw new Error(`Meetup ${getMeetupSlug(meetup)} does not have a valid schedule.`)
  }

  const title = encodeURIComponent(meetup.title)
  const detailsSource = links.meetup
    ? `${summary}\n\nMore details: ${links.meetup}`
    : summary
  const details = encodeURIComponent(detailsSource)
  const location = encodeURIComponent(joinParts([locationParts.name, locationParts.address, locationParts.city]))
  const start = startsAt.replace(/[-:]/g, '').replace('.000', '')
  const end = endsAt.replace(/[-:]/g, '').replace('.000', '')

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(startsAt)}&enddt=${encodeURIComponent(endsAt)}&body=${details}&location=${location}`,
  }
}

export function buildIcs(meetup: Meetup): string {
  const links = getMeetupLinks(meetup)
  const summary = getMeetupSummary(meetup)
  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)
  const locationParts = getMeetupLocationParts(meetup)

  if (!startsAt || !endsAt) {
    throw new Error(`Meetup ${getMeetupSlug(meetup)} does not have a valid schedule.`)
  }

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
    `DTSTART:${toUtcStamp(startsAt)}`,
    `DTEND:${toUtcStamp(endsAt)}`,
    `SUMMARY:${escape(meetup.title)}`,
    `DESCRIPTION:${escape(links.meetup ? `${summary}\n\nMore details: ${links.meetup}` : summary)}`,
    `LOCATION:${escape(joinParts([locationParts.name, locationParts.address, locationParts.city]))}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
