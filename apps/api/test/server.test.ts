import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MeetupCache } from '@codersmu/core'

const sampleCache: MeetupCache = {
  source: 'https://coders.mu/meetups/',
  scrapedAt: '2099-04-18T06:00:00.000Z',
  meetups: [
    {
      id: 'future-meetup',
      title: 'Future Meetup',
      description: 'A sample meetup used in API tests.',
      date: '2099-04-18',
      startTime: '10:00',
      endTime: '14:00',
      venue: 'Test Venue',
      location: 'Moka',
      status: 'published',
      photos: [],
      sessions: [],
      sponsors: [],
      acceptingRsvp: 0,
      seatsAvailable: null,
    },
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
  vi.clearAllMocks()
  vi.resetModules()
})

function resetFetchFrontendMuMeetupsMock() {
  fetchFrontendMuMeetupsMock.mockReset()
  fetchFrontendMuMeetupsMock.mockResolvedValue(sampleCache)
}

describe('handleRequest', () => {
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
  })

  it('uses the explicit upstream API base URL for producer fetches', async () => {
    process.env.CODERSMU_UPSTREAM_API_BASE_URL = 'https://frontendmu.example/api/public/v1/'
    resetFetchFrontendMuMeetupsMock()

    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=all'))

    expect(response.status).toBe(200)
    expect(fetchFrontendMuMeetupsMock).toHaveBeenCalledWith({
      apiBaseUrl: 'https://frontendmu.example/api/public/v1',
    })
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
    expect(fetchFrontendMuMeetupsMock).toHaveBeenNthCalledWith(1, {
      apiBaseUrl: 'https://coders.mu/api/public/v1',
    })
    expect(fetchFrontendMuMeetupsMock).toHaveBeenNthCalledWith(2, {
      apiBaseUrl: 'https://coders.mu/api/public/v1',
    })
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_refresh_failed"'))
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"provider_stale_cache_reused"'))

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
