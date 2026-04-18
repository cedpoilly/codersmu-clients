import type { Meetup, MeetupCache } from '../types'

const API_BASE_URL = process.env.CODERSMU_API_BASE_URL ?? 'https://coders.mu/api/public/v1'
const MEETUPS_API_URL = `${API_BASE_URL}/meetups`
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

async function fetchJson<T>(url: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        accept: 'application/json',
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

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

async function fetchMeetupIndex(): Promise<RawMeetup[]> {
  return fetchJson<RawMeetup[]>(MEETUPS_API_URL)
}

async function fetchMeetupDetail(id: string): Promise<RawMeetup> {
  return fetchJson<RawMeetup>(`${MEETUPS_API_URL}/${encodeURIComponent(id)}`)
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
    status: rawMeetup.status,
    album: rawMeetup.album ?? null,
    updatedAt: rawMeetup.updatedAt ?? null,
    coverImageUrl: rawMeetup.coverImageUrl ?? null,
    photos: rawMeetup.photos ?? [],
    sessions: (rawMeetup.sessions ?? []).map((session) => ({
      id: session.id,
      title: session.title,
      description: session.description ?? null,
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
    seatsAvailable: rawMeetup.seatsAvailable ?? null,
    rsvpClosingDate: rawMeetup.rsvpClosingDate ?? null,
    rsvpLink: rawMeetup.rsvpLink ?? null,
    mapUrl: rawMeetup.mapUrl ?? null,
    parkingLocation: rawMeetup.parkingLocation ?? null,
  }
}

export async function fetchFrontendMuMeetups(): Promise<MeetupCache> {
  const meetups = await fetchMeetupIndex()
  const details = await mapConcurrent(meetups, 4, async (meetup) => fetchMeetupDetail(meetup.id))

  return {
    source: MEETUPS_API_URL,
    scrapedAt: new Date().toISOString(),
    meetups: details.map(normalizeMeetup),
  }
}
