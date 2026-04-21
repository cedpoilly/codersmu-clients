import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Meetup, MeetupCache } from '@codersmu/core'

function makeMeetup(overrides: Partial<Meetup> & Pick<Meetup, 'id' | 'title' | 'date' | 'status'>): Meetup {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? 'A sample meetup used in API tests.',
    date: overrides.date,
    startTime: overrides.startTime ?? '10:00',
    endTime: overrides.endTime ?? '14:00',
    venue: overrides.venue ?? 'Test Venue',
    location: overrides.location ?? 'Moka',
    status: overrides.status,
    album: overrides.album ?? null,
    updatedAt: overrides.updatedAt ?? null,
    coverImageUrl: overrides.coverImageUrl ?? null,
    photos: overrides.photos ?? [],
    sessions: overrides.sessions ?? [],
    sponsors: overrides.sponsors ?? [],
    attendeeCount: overrides.attendeeCount,
    seatsAvailable: overrides.seatsAvailable ?? null,
    capacityTotal: overrides.capacityTotal ?? null,
    rsvpCount: overrides.rsvpCount ?? null,
    seatsRemaining: overrides.seatsRemaining ?? null,
    acceptingRsvp: overrides.acceptingRsvp,
    rsvpClosingDate: overrides.rsvpClosingDate ?? null,
    rsvpLink: overrides.rsvpLink ?? null,
    mapUrl: overrides.mapUrl ?? null,
    parkingLocation: overrides.parkingLocation ?? null,
  }
}

const sampleCache: MeetupCache = {
  source: 'https://coders.mu/meetups/',
  scrapedAt: '2099-04-18T06:00:00.000Z',
  meetups: [
    makeMeetup({
      id: 'future-meetup',
      title: 'Future Meetup',
      date: '2099-04-18',
      status: 'published',
      acceptingRsvp: 0,
    }),
  ],
}

const fetchFrontendMuMeetupsMock = vi.fn().mockResolvedValue(sampleCache)

vi.mock('@codersmu/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codersmu/core')>()
  return {
    ...actual,
    fetchFrontendMuMeetups: fetchFrontendMuMeetupsMock,
  }
})

afterEach(() => {
  delete process.env.CODERSMU_UPSTREAM_API_BASE_URL
  delete process.env.CODERSMU_API_LOG_LEVEL
  delete process.env.CODERSMU_RELEASE_SHA
  delete process.env.CODERSMU_API_CACHE_FILE
  vi.clearAllMocks()
  vi.resetModules()
})

function resetFetchFrontendMuMeetupsMock() {
  fetchFrontendMuMeetupsMock.mockReset()
  fetchFrontendMuMeetupsMock.mockResolvedValue(sampleCache)
}

describe('handleRequest', () => {
  it('includes service and version metadata in health responses and headers', async () => {
    process.env.CODERSMU_RELEASE_SHA = 'abc123def'
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/health'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      service: 'codersmu-api',
      version: '0.0.0-prototype.1',
      releaseSha: 'abc123def',
    })
    expect(response.headers.get('x-codersmu-service')).toBe('codersmu-api')
    expect(response.headers.get('x-codersmu-version')).toBe('0.0.0-prototype.1')
    expect(response.headers.get('x-codersmu-release-sha')).toBe('abc123def')
  })

  it('logs successful requests and provider refreshes in structured JSON', async () => {
    process.env.CODERSMU_API_LOG_LEVEL = 'info'
    resetFetchFrontendMuMeetupsMock()
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=all'))

    expect(response.status).toBe(200)
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_refresh_started"'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_refresh_succeeded"'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"request_completed"'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"pathname":"/meetups"'))
  })

  it('treats HEAD health checks like GET', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/health', {
      method: 'HEAD',
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-codersmu-service')).toBe('codersmu-api')
    expect(response.headers.get('x-codersmu-version')).toBe('0.0.0-prototype.1')
  })

  it('uses the explicit upstream API base URL for producer fetches', async () => {
    process.env.CODERSMU_UPSTREAM_API_BASE_URL = 'https://frontendmu.example/api/public/v1/'
    resetFetchFrontendMuMeetupsMock()

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=all'))

    expect(response.status).toBe(200)
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledWith(expect.objectContaining({
      apiBaseUrl: 'https://frontendmu.example/api/public/v1',
    }))
  })

  it('returns the standardized meetup list response', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=all'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetups: sampleCache.meetups,
    })
  })

  it('returns the standardized next meetup response', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetup: sampleCache.meetups[0],
    })
  })

  it('returns null from /meetups/next when no meetup is upcoming', async () => {
    fetchFrontendMuMeetupsMock.mockReset()
    fetchFrontendMuMeetupsMock.mockResolvedValue({
      ...sampleCache,
      meetups: [
        makeMeetup({
          id: 'completed-meetup',
          title: 'Completed Meetup',
          date: '2000-01-10',
          status: 'published',
        }),
        makeMeetup({
          id: 'cancelled-meetup',
          title: 'Cancelled Meetup',
          date: '2099-04-19',
          status: 'canceled',
        }),
      ],
    })

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetup: null,
    })
  })

  it('returns the earliest upcoming meetup with the raw fields clients depend on', async () => {
    const earliestUpcomingMeetup = makeMeetup({
      id: 'earliest-upcoming-meetup',
      title: 'Earliest Upcoming Meetup',
      description: 'The meetup that macOS should hydrate from /meetups/next.',
      date: '2099-04-20',
      startTime: '08:30',
      endTime: '12:45',
      venue: 'Core Building',
      location: 'Ebene',
      status: 'published',
      attendeeCount: 42,
      seatsAvailable: 12,
      capacityTotal: 30,
      rsvpCount: 18,
      seatsRemaining: 12,
      acceptingRsvp: 1,
      rsvpClosingDate: '2099-04-19T20:00:00.000Z',
      rsvpLink: 'https://lu.ma/earliest-upcoming-meetup',
      mapUrl: 'https://maps.example.com/earliest-upcoming-meetup',
      parkingLocation: 'https://parking.example.com/earliest-upcoming-meetup',
    })

    fetchFrontendMuMeetupsMock.mockReset()
    fetchFrontendMuMeetupsMock.mockResolvedValue({
      ...sampleCache,
      meetups: [
        makeMeetup({
          id: 'later-upcoming-meetup',
          title: 'Later Upcoming Meetup',
          date: '2099-04-22',
          startTime: '18:00',
          endTime: '22:00',
          status: 'published',
        }),
        makeMeetup({
          id: 'cancelled-upcoming-meetup',
          title: 'Cancelled Upcoming Meetup',
          date: '2099-04-19',
          status: 'canceled',
        }),
        earliestUpcomingMeetup,
        makeMeetup({
          id: 'past-meetup',
          title: 'Past Meetup',
          date: '2000-01-01',
          status: 'published',
        }),
      ],
    })

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json() as { meetup: Meetup | null }

    expect(response.status).toBe(200)
    expect(Object.keys(payload)).toEqual(['meetup'])
    expect(payload.meetup).toEqual(earliestUpcomingMeetup)
    expect(payload.meetup).toMatchObject({
      id: 'earliest-upcoming-meetup',
      title: 'Earliest Upcoming Meetup',
      date: '2099-04-20',
      startTime: '08:30',
      endTime: '12:45',
      venue: 'Core Building',
      location: 'Ebene',
      status: 'published',
      attendeeCount: 42,
      seatsAvailable: 12,
      capacityTotal: 30,
      rsvpCount: 18,
      seatsRemaining: 12,
      acceptingRsvp: 1,
      rsvpClosingDate: '2099-04-19T20:00:00.000Z',
      rsvpLink: 'https://lu.ma/earliest-upcoming-meetup',
      mapUrl: 'https://maps.example.com/earliest-upcoming-meetup',
      parkingLocation: 'https://parking.example.com/earliest-upcoming-meetup',
    })
  })

  it('returns 404 for an unknown meetup slug', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/unknown-slug'))
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({
      error: 'Meetup "unknown-slug" was not found.',
    })
  })

  it('returns 400 for an unsupported list state', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=broken'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Unsupported meetup list state "broken". Expected one of: upcoming, past, all.',
    })
  })

  it('reuses the in-memory API cache across requests', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    await handleRequest(new Request('http://localhost/meetups?state=all'))
    await handleRequest(new Request('http://localhost/meetups/next'))

    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledTimes(1)
  })

  it('reuses the last good provider when a refresh fails after the TTL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2099-04-18T06:00:00.000Z'))
    process.env.CODERSMU_API_LOG_LEVEL = 'info'
    resetFetchFrontendMuMeetupsMock()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchFrontendMuMeetupsMock
      .mockResolvedValueOnce(sampleCache)
      .mockRejectedValueOnce(new Error('frontend api down'))

    const { handleRequest } = await import('../src/server')

    const warmResponse = await handleRequest(new Request('http://localhost/meetups?state=all'))
    expect(warmResponse.status).toBe(200)

    vi.setSystemTime(new Date('2099-04-18T06:01:01.000Z'))

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetup: sampleCache.meetups[0],
    })
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledTimes(2)
    expect(fetchFrontendMuMeetupsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      apiBaseUrl: 'https://coders.mu/api/public/v1',
    }))
    expect(fetchFrontendMuMeetupsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      apiBaseUrl: 'https://coders.mu/api/public/v1',
    }))
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_refresh_failed"'))
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_stale_cache_reused"'))

    vi.useRealTimers()
  })

  it('reuses the persisted disk cache after a cold-start refresh failure', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'codersmu-api-cache-'))
    const cacheFile = join(cacheDir, 'meetups-cache.json')
    process.env.CODERSMU_API_CACHE_FILE = cacheFile
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cacheFile, `${JSON.stringify(sampleCache, null, 2)}\n`, 'utf8')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2099-04-18T06:30:00.000Z'))

    resetFetchFrontendMuMeetupsMock()
    fetchFrontendMuMeetupsMock.mockRejectedValueOnce(new Error('frontend api down'))

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetup: sampleCache.meetups[0],
    })
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledTimes(1)
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledWith({
      apiBaseUrl: 'https://coders.mu/api/public/v1',
      onDetailFailure: expect.any(Function),
    })

    vi.useRealTimers()
  })

  it('rejects a stale persisted disk cache after a cold-start refresh failure', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'codersmu-api-cache-'))
    const cacheFile = join(cacheDir, 'meetups-cache.json')
    process.env.CODERSMU_API_CACHE_FILE = cacheFile
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cacheFile, `${JSON.stringify({
      ...sampleCache,
      scrapedAt: '2099-04-18T06:00:00.000Z',
    }, null, 2)}\n`, 'utf8')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2099-04-18T07:30:01.000Z'))

    resetFetchFrontendMuMeetupsMock()
    fetchFrontendMuMeetupsMock.mockRejectedValueOnce(new Error('frontend api down'))

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      error: 'Internal server error.',
    })
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('still rejects unsupported methods', async () => {
    resetFetchFrontendMuMeetupsMock()
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/health', {
      method: 'POST',
    }))
    const payload = await response.json()

    expect(response.status).toBe(405)
    expect(payload).toEqual({
      error: 'Method not allowed.',
    })
  })
})
