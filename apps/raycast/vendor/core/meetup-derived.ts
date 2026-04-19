import type { Meetup, MeetupSession, MeetupSpeaker } from './types'

const API_BASE_URL = process.env.CODERSMU_API_BASE_URL ?? 'https://coders.mu/api/public/v1'
const SITE_BASE_URL = new URL(API_BASE_URL).origin
const MAURITIUS_TIMEZONE = 'Indian/Mauritius'
const MAURITIUS_UTC_OFFSET = '+04:00'
const DEFAULT_DURATION_HOURS = 4

export type MeetupLifecycleStatus = 'scheduled' | 'ongoing' | 'completed'

export interface MeetupLocationParts {
  name?: string
  address?: string
  city?: string
}

export interface MeetupLinks {
  meetup: string
  rsvp?: string
  map?: string
  parking?: string
}

function normalizeHttpsUrl(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : undefined
  }
  catch {
    return undefined
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replaceAll(/&(#(\d+)|#x([0-9a-fA-F]+)|[a-zA-Z]+);/g, (entity, _whole, decimal, hex) => {
    if (decimal) {
      return String.fromCodePoint(Number(decimal))
    }

    if (hex) {
      return String.fromCodePoint(Number.parseInt(hex, 16))
    }

    switch (entity) {
      case '&quot;':
        return '"'
      case '&amp;':
        return '&'
      case '&lt;':
        return '<'
      case '&gt;':
        return '>'
      case '&apos;':
      case '&#039;':
        return '\''
      case '&nbsp;':
        return ' '
      default:
        return entity
    }
  })
}

export function stripHtml(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  return decodeHtmlEntities(
    value
      .replaceAll(/<br\s*\/?>/gi, '\n')
      .replaceAll(/<\/p>/gi, '\n\n')
      .replaceAll(/<li>/gi, '- ')
      .replaceAll(/<\/li>/gi, '\n')
      .replaceAll(/<[^>]+>/g, '')
      .replaceAll(/\r/g, ''),
  )
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

function normalizeTime(value: string | null | undefined, fallback = '10:00'): string {
  const source = value?.trim() || fallback
  const [hours = '10', minutes = '00'] = source.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function buildUtcIso(date: string, time: string): string {
  const day = date.slice(0, 10)
  return new Date(`${day}T${time}:00${MAURITIUS_UTC_OFFSET}`).toISOString()
}

function getLocalDateString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = normalizeTime(time).split(':')
  return Number(hours) * 60 + Number(minutes)
}

function buildEndUtcIso(date: string, startTime: string, endTime?: string | null): string {
  const startMinutes = toMinutes(startTime)

  if (!endTime) {
    return new Date(Date.parse(buildUtcIso(date, startTime)) + DEFAULT_DURATION_HOURS * 60 * 60 * 1000).toISOString()
  }

  let endMinutes = toMinutes(normalizeTime(endTime))
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60
  }

  const normalizedHours = Math.floor(endMinutes / 60) % 24
  const normalizedMinutes = endMinutes % 60
  const dayOffset = Math.floor(endMinutes / (24 * 60))
  const localDate = addDaysToDateString(date, dayOffset)
  return buildUtcIso(localDate, `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`)
}

export function getMeetupSlug(meetup: Meetup): string {
  const datePrefix = meetup.date?.slice(0, 10)
  if (datePrefix) {
    return `${datePrefix}-${slugify(stripHtml(meetup.title))}`
  }

  return meetup.id
}

export function getMeetupSummary(meetup: Meetup): string {
  const description = stripHtml(meetup.description)
  if (description) {
    return description
  }

  if (meetup.sessions.length) {
    return meetup.sessions
      .map((session) => stripHtml(session.title))
      .filter(Boolean)
      .join(' | ')
  }

  return 'No meetup description published yet.'
}

export function getMeetupStartsAt(meetup: Meetup): string | undefined {
  const startTime = meetup.startTime?.trim()
  if (!meetup.date || !startTime) {
    return undefined
  }

  return buildUtcIso(meetup.date, normalizeTime(startTime))
}

export function getMeetupEndsAt(meetup: Meetup): string | undefined {
  const startTime = meetup.startTime?.trim()
  if (!meetup.date || !startTime) {
    return undefined
  }

  return buildEndUtcIso(meetup.date, normalizeTime(startTime), meetup.endTime)
}

export function getMeetupSortTimestamp(meetup: Meetup): number {
  const startsAt = getMeetupStartsAt(meetup)
  if (startsAt) {
    return Date.parse(startsAt)
  }

  const meetupDate = meetup.date?.slice(0, 10)
  if (!meetupDate) {
    return Number.POSITIVE_INFINITY
  }

  return Date.parse(`${meetupDate}T23:59:59${MAURITIUS_UTC_OFFSET}`)
}

export function getMeetupTimezone(_meetup?: Meetup): string {
  return MAURITIUS_TIMEZONE
}

export function getMeetupLifecycleStatus(meetup: Meetup): MeetupLifecycleStatus {
  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)

  if (!startsAt || !endsAt) {
    const meetupDate = meetup.date?.slice(0, 10)
    if (meetupDate && meetupDate < getLocalDateString(new Date(), MAURITIUS_TIMEZONE)) {
      return 'completed'
    }

    return 'scheduled'
  }

  const now = Date.now()
  const startsAtMs = Date.parse(startsAt)
  const endsAtMs = Date.parse(endsAt)

  if (now < startsAtMs) {
    return 'scheduled'
  }

  if (now <= endsAtMs) {
    return 'ongoing'
  }

  return 'completed'
}

export function getMeetupLocationParts(meetup: Meetup): MeetupLocationParts {
  return {
    name: stripHtml(meetup.venue) || undefined,
    address: stripHtml(meetup.location) || undefined,
  }
}

export function getMeetupLinks(meetup: Meetup): MeetupLinks {
  const meetupUrl = `${SITE_BASE_URL}/meetup/${encodeURIComponent(meetup.id)}`

  return {
    meetup: meetupUrl,
    rsvp: normalizeHttpsUrl(meetup.rsvpLink) ?? (meetup.acceptingRsvp ? meetupUrl : undefined),
    map: normalizeHttpsUrl(meetup.mapUrl),
    parking: normalizeHttpsUrl(meetup.parkingLocation),
  }
}

export function dedupeMeetupSpeakers(sessions: MeetupSession[]): MeetupSpeaker[] {
  const seen = new Set<string>()
  const speakers: MeetupSpeaker[] = []

  for (const session of sessions) {
    for (const speaker of session.speakers) {
      const key = `${speaker.name}:${speaker.githubUsername ?? ''}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      speakers.push(speaker)
    }
  }

  return speakers
}

export function getMeetupSpeakerNames(meetup: Meetup): string[] {
  return dedupeMeetupSpeakers(meetup.sessions).map((speaker) => speaker.name)
}
