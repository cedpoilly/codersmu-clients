import type { Meetup, MeetupCache } from '../types'

const DEFAULT_API_BASE_URL = 'https://coders.mu/api/public/v1'
const FETCH_TIMEOUT_MS = 10_000
const DATA_PAGE_PATTERN = /data-page="([^"]+)"/

export interface FetchFrontendMuMeetupsOptions {
  apiBaseUrl?: string
  onDetailFailure?: (meetupId: string, error: unknown) => void
}

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
  durationMinutes?: number | null
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
  slug?: string | null
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
  rsvpCount?: number | null
  rsvpClosingDate?: string | null
  rsvpLink?: string | null
  mapUrl?: string | null
  parkingLocation?: string | null
}

interface RawMeetupPagePayload {
  props?: {
    rsvpCount?: number | null
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetchResponse(url, 'application/json')
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetchResponse(url, accept)
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}

async function fetchResponse(url: string, accept: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: {
        accept,
        'user-agent': 'codersmu-clients/0.0.0-prototype.1 (+https://coders.mu)',
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
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '')
}

function resolveApiBaseUrl(options?: FetchFrontendMuMeetupsOptions): string {
  return normalizeApiBaseUrl(options?.apiBaseUrl ?? process.env.CODERSMU_API_BASE_URL ?? DEFAULT_API_BASE_URL)
}

async function fetchMeetupIndex(meetupsApiUrl: string): Promise<RawMeetup[]> {
  return fetchJson<RawMeetup[]>(meetupsApiUrl)
}

async function fetchMeetupDetail(meetupsApiUrl: string, id: string): Promise<RawMeetup> {
  return fetchJson<RawMeetup>(`${meetupsApiUrl}/${encodeURIComponent(id)}`)
}

function buildMeetupPageUrl(apiBaseUrl: string, id: string): string {
  const siteBaseUrl = new URL(apiBaseUrl).origin
  return `${siteBaseUrl}/meetup/${encodeURIComponent(id)}`
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
  const match = html.match(DATA_PAGE_PATTERN)
  if (!match?.[1]) {
    throw new Error('Meetup page did not include a data-page payload.')
  }

  return decodeHtmlEntities(match[1])
}

async function fetchMeetupPageRsvpCount(apiBaseUrl: string, id: string): Promise<number | null> {
  const html = await fetchText(buildMeetupPageUrl(apiBaseUrl, id), 'text/html,application/xhtml+xml')
  const payload = JSON.parse(extractDataPageJson(html)) as RawMeetupPagePayload
  return payload.props?.rsvpCount ?? null
}

function normalizeSeatMetrics(rawMeetup: RawMeetup): Pick<Meetup, 'seatsAvailable' | 'capacityTotal' | 'rsvpCount' | 'seatsRemaining'> {
  const capacityTotal = rawMeetup.seatsAvailable ?? null
  const rsvpCount = rawMeetup.rsvpCount ?? null
  const seatsRemaining = typeof capacityTotal === 'number' && typeof rsvpCount === 'number'
    ? Math.max(capacityTotal - rsvpCount, 0)
    : null

  return {
    seatsAvailable: capacityTotal,
    capacityTotal,
    rsvpCount,
    seatsRemaining,
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

function normalizeMeetup(rawMeetup: RawMeetup): Meetup {
  const normalizedStatus = rawMeetup.status?.trim().toLowerCase() === 'cancelled'
    ? 'canceled'
    : rawMeetup.status
  const seatMetrics = normalizeSeatMetrics(rawMeetup)

  return {
    id: rawMeetup.id,
    slug: rawMeetup.slug ?? null,
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
      title: session.title,
      description: session.description ?? null,
      durationMinutes: session.durationMinutes ?? null,
      order: session.order ?? null,
      speakers: (session.speakers ?? []).map((speaker) => ({
        id: speaker.id,
        name: speaker.name,
        githubUsername: speaker.githubUsername ?? null,
        avatarUrl: speaker.avatarUrl ?? null,
        featured: speaker.featured ?? null,
      })),
    })),
    sponsors: (rawMeetup.sponsors ?? []).map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      website: sponsor.website ?? null,
      logoUrl: sponsor.logoUrl ?? null,
      sponsorTypes: sponsor.sponsorTypes ?? [],
      logoBg: sponsor.logoBg ?? null,
      status: sponsor.status ?? null,
    })),
    ...seatMetrics,
    rsvpClosingDate: rawMeetup.rsvpClosingDate ?? null,
    rsvpLink: rawMeetup.rsvpLink ?? null,
    mapUrl: rawMeetup.mapUrl ?? null,
    parkingLocation: rawMeetup.parkingLocation ?? null,
  }
}

export async function fetchFrontendMuMeetups(options?: FetchFrontendMuMeetupsOptions): Promise<MeetupCache> {
  const apiBaseUrl = resolveApiBaseUrl(options)
  const meetupsApiUrl = `${apiBaseUrl}/meetups`
  const meetups = await fetchMeetupIndex(meetupsApiUrl)
  const details = await mapConcurrent(meetups, 4, async (meetup) => {
    try {
      const detail = await fetchMeetupDetail(meetupsApiUrl, meetup.id)

      if (typeof detail.seatsAvailable === 'number' && detail.rsvpCount == null) {
        try {
          return {
            ...detail,
            rsvpCount: await fetchMeetupPageRsvpCount(apiBaseUrl, meetup.id),
          }
        }
        catch {
          return detail
        }
      }

      return detail
    }
    catch (error) {
      options?.onDetailFailure?.(meetup.id, error)
      return meetup
    }
  })

  return {
    source: meetupsApiUrl,
    scrapedAt: new Date().toISOString(),
    meetups: details.map(normalizeMeetup),
  }
}
