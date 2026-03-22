import type { Meetup, MeetupCache, MeetupSession, MeetupSpeaker, MeetupSponsor } from '../types'

const SOURCE_URL = 'https://coders.mu/meetups/'
const DETAIL_URL_PREFIX = 'https://coders.mu/meetup/'
const MAURITIUS_UTC_OFFSET = '+04:00'
const DEFAULT_DURATION_HOURS = 4

interface RawSpeaker {
  name: string
  githubUsername?: string | null
  avatarUrl?: string | null
  featured?: number | boolean
}

interface RawSession {
  title: string
  description?: string | null
  speakers?: RawSpeaker[]
}

interface RawSponsor {
  name: string
  website?: string | null
  sponsorTypes?: string[]
}

interface RawMeetup {
  id: string
  title: string
  description?: string | null
  date: string | null
  startTime?: string | null
  endTime?: string | null
  venue?: string | null
  location?: string | null
  attendeeCount?: number
  acceptingRsvp?: number | boolean
  sessions?: RawSession[]
  sponsors?: RawSponsor[]
  seatsAvailable?: number | null
  rsvpCount?: number
  rsvpLink?: string | null
  mapUrl?: string | null
  parkingLocation?: string | null
}

interface IndexPayload {
  props: {
    meetups: RawMeetup[]
  }
}

interface DetailPayload {
  props: {
    meetup: RawMeetup
    rsvpCount?: number
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

function extractDataPageJson(html: string): string {
  const match = html.match(/data-page="([^"]+)"/)
  if (!match) {
    throw new Error('Unable to find data-page payload in coders.mu response.')
  }

  return decodeHtmlEntities(match[1])
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'codersmu-cli/0.1.0 (+https://coders.mu)',
      'accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

async function fetchIndexMeetups(): Promise<RawMeetup[]> {
  const html = await fetchText(SOURCE_URL)
  const payload = JSON.parse(extractDataPageJson(html)) as IndexPayload
  return payload.props.meetups
}

async function fetchMeetupDetail(id: string): Promise<RawMeetup> {
  const html = await fetchText(`${DETAIL_URL_PREFIX}${id}`)
  const payload = JSON.parse(extractDataPageJson(html)) as DetailPayload
  return {
    ...payload.props.meetup,
    rsvpCount: payload.props.rsvpCount ?? payload.props.meetup.rsvpCount,
  }
}

async function mapConcurrent<Input, Output>(
  values: Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> {
  const results: Output[] = new Array(values.length)
  let nextIndex = 0

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(values[currentIndex], currentIndex)
    }
  }))

  return results
}

function slugify(value: string): string {
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

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function buildEndUtcIso(date: string, startTime: string, endTime?: string | null): string {
  const startMinutes = toMinutes(startTime)

  if (!endTime) {
    return new Date(Date.parse(buildUtcIso(date, startTime)) + DEFAULT_DURATION_HOURS * 60 * 60 * 1000).toISOString()
  }

  let endMinutes = toMinutes(normalizeTime(endTime))
  while (endMinutes <= startMinutes) {
    endMinutes += 12 * 60
  }

  const normalizedHours = Math.floor(endMinutes / 60) % 24
  const normalizedMinutes = endMinutes % 60
  const dayOffset = Math.floor(endMinutes / (24 * 60))
  const localDate = addDaysToDateString(date, dayOffset)
  return buildUtcIso(localDate, `${String(normalizedHours).padStart(2, '0')}:${String(normalizedMinutes).padStart(2, '0')}`)
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = normalizeTime(time).split(':')
  return Number(hours) * 60 + Number(minutes)
}

function stripHtml(value: string | null | undefined): string {
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

function dedupeSpeakers(sessions: MeetupSession[]): MeetupSpeaker[] {
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

function deriveStatus(startsAt: string, endsAt: string): Meetup['status'] {
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

function normalizeSessions(rawSessions: RawSession[] | undefined): MeetupSession[] {
  return (rawSessions ?? []).map((session) => ({
    title: stripHtml(session.title),
    description: stripHtml(session.description),
    speakers: (session.speakers ?? []).map((speaker) => ({
      name: speaker.name,
      githubUsername: speaker.githubUsername ?? undefined,
      avatarUrl: speaker.avatarUrl ?? null,
      featured: Boolean(speaker.featured),
    })),
  }))
}

function normalizeSponsors(rawSponsors: RawSponsor[] | undefined): MeetupSponsor[] {
  return (rawSponsors ?? []).map((sponsor) => ({
    name: sponsor.name,
    website: sponsor.website ?? undefined,
    sponsorTypes: sponsor.sponsorTypes ?? [],
  }))
}

function normalizeMeetup(rawMeetup: RawMeetup): Meetup {
  if (!rawMeetup.date) {
    throw new Error(`Meetup ${rawMeetup.id} does not have a date.`)
  }

  const startTime = normalizeTime(rawMeetup.startTime)
  const startsAt = buildUtcIso(rawMeetup.date, startTime)
  const endsAt = buildEndUtcIso(rawMeetup.date, startTime, rawMeetup.endTime)
  const sessions = normalizeSessions(rawMeetup.sessions)
  const venue = stripHtml(rawMeetup.venue) || 'TBA'
  const address = stripHtml(rawMeetup.location) || undefined
  const summary = stripHtml(rawMeetup.description) || (sessions.length
    ? sessions.map((session) => session.title).join(' | ')
    : 'No meetup description published yet.')
  const slug = `${rawMeetup.date.slice(0, 10)}-${slugify(rawMeetup.title)}`

  return {
    id: rawMeetup.id,
    slug,
    title: stripHtml(rawMeetup.title),
    summary,
    startsAt,
    endsAt,
    timezone: 'Indian/Mauritius',
    status: deriveStatus(startsAt, endsAt),
    location: {
      name: venue,
      address,
    },
    speakers: dedupeSpeakers(sessions),
    sessions,
    sponsors: normalizeSponsors(rawMeetup.sponsors),
    attendeeCount: rawMeetup.attendeeCount,
    seatsAvailable: rawMeetup.seatsAvailable ?? null,
    rsvpCount: rawMeetup.rsvpCount,
    acceptingRsvp: Boolean(rawMeetup.acceptingRsvp),
    links: {
      meetup: `${DETAIL_URL_PREFIX}${rawMeetup.id}`,
      map: rawMeetup.mapUrl ?? undefined,
      parking: rawMeetup.parkingLocation ?? undefined,
      rsvp: rawMeetup.rsvpLink ?? undefined,
    },
  }
}

export async function scrapeCodersMuMeetups(): Promise<MeetupCache> {
  const indexMeetups = await fetchIndexMeetups()
  const details = await mapConcurrent(indexMeetups, 4, async (meetup) => fetchMeetupDetail(meetup.id))

  return {
    source: SOURCE_URL,
    scrapedAt: new Date().toISOString(),
    meetups: details.map(normalizeMeetup),
  }
}
