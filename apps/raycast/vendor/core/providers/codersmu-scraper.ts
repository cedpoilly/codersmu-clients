import type { Meetup, MeetupCache } from '../types'

const SOURCE_URL = 'https://coders.mu/meetups/'
const DETAIL_URL_PREFIX = 'https://coders.mu/meetup/'
const FETCH_TIMEOUT_MS = 10_000

interface RawSpeaker {
  id: string
  name: string
  githubUsername?: string | null
  avatarUrl?: string | null
  featured?: number | null
}

interface RawSession {
  id: string
  title: string
  description?: string | null
  order?: number | null
  speakers?: RawSpeaker[]
}

interface RawSponsor {
  id: string
  name: string
  website?: string | null
  logoUrl?: string | null
  sponsorTypes?: string[]
  logoBg?: string | null
  status?: string | null
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
  acceptingRsvp?: number | null
  status: string
  album?: string | null
  updatedAt?: string | null
  coverImageUrl?: string | null
  photos?: Array<Record<string, unknown>>
  sessions?: RawSession[]
  sponsors?: RawSponsor[]
  seatsAvailable?: number | null
  rsvpClosingDate?: string | null
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

function extractDataPageJson(html: string): string {
  const match = html.match(/data-page="([^"]+)"/)
  if (!match) {
    throw new Error('Unable to find data-page payload in coders.mu response.')
  }

  return decodeHtmlEntities(match[1])
}

async function fetchText(url: string): Promise<string> {
  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        'user-agent': 'codersmu-clients/0.0.0-prototype.1 (+https://coders.mu)',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  }
  catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new Error(`Request timed out for ${url} after ${FETCH_TIMEOUT_MS}ms.`)
    }

    throw error
  }

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
  return payload.props.meetup
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

function normalizeMeetup(rawMeetup: RawMeetup): Meetup {
  const normalizedStatus = rawMeetup.status?.trim().toLowerCase() === 'cancelled'
    ? 'canceled'
    : rawMeetup.status

  return {
    id: rawMeetup.id,
    title: rawMeetup.title,
    description: rawMeetup.description ?? null,
    date: rawMeetup.date,
    startTime: rawMeetup.startTime ?? null,
    endTime: rawMeetup.endTime ?? null,
    venue: rawMeetup.venue ?? null,
    location: rawMeetup.location ?? null,
    attendeeCount: rawMeetup.attendeeCount,
    acceptingRsvp: rawMeetup.acceptingRsvp,
    status: normalizedStatus,
    album: rawMeetup.album ?? null,
    updatedAt: rawMeetup.updatedAt ?? null,
    coverImageUrl: rawMeetup.coverImageUrl ?? null,
    photos: rawMeetup.photos ?? [],
    sessions: (rawMeetup.sessions ?? []).map((session) => ({
      id: session.id,
      title: stripHtml(session.title),
      description: stripHtml(session.description) || null,
      order: session.order ?? null,
      speakers: (session.speakers ?? []).map((speaker) => ({
        id: speaker.id,
        name: stripHtml(speaker.name),
        githubUsername: speaker.githubUsername ?? null,
        avatarUrl: speaker.avatarUrl ?? null,
        featured: speaker.featured ?? null,
      })),
    })),
    sponsors: (rawMeetup.sponsors ?? []).map((sponsor) => ({
      id: sponsor.id,
      name: stripHtml(sponsor.name),
      website: sponsor.website ?? null,
      logoUrl: sponsor.logoUrl ?? null,
      sponsorTypes: sponsor.sponsorTypes ?? [],
      logoBg: sponsor.logoBg ?? null,
      status: sponsor.status ?? null,
    })),
    seatsAvailable: rawMeetup.seatsAvailable ?? null,
    rsvpClosingDate: rawMeetup.rsvpClosingDate ?? null,
    rsvpLink: rawMeetup.rsvpLink ?? null,
    mapUrl: rawMeetup.mapUrl ?? null,
    parkingLocation: rawMeetup.parkingLocation ?? null,
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
