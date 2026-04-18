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

vi.mock('@codersmu/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codersmu/core')>()
  return {
    ...actual,
    fetchFrontendMuMeetups: vi.fn().mockResolvedValue(sampleCache),
  }
})

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('handleRequest', () => {
  it('returns the standardized meetup list response', async () => {
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=all'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetups: sampleCache.meetups,
    })
  })

  it('returns the standardized next meetup response', async () => {
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/next'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      meetup: sampleCache.meetups[0],
    })
  })

  it('returns 404 for an unknown meetup slug', async () => {
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups/unknown-slug'))
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload).toEqual({
      error: 'Meetup "unknown-slug" was not found.',
    })
  })

  it('returns 400 for an unsupported list state', async () => {
    const { handleRequest } = await import('../src/server')

    const response = await handleRequest(new Request('http://localhost/meetups?state=broken'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({
      error: 'Unsupported meetup list state "broken". Expected one of: upcoming, past, all.',
    })
  })

  it('reuses the in-memory API cache across requests', async () => {
    const core = await import('@codersmu/core')
    const { handleRequest } = await import('../src/server')

    await handleRequest(new Request('http://localhost/meetups?state=all'))
    await handleRequest(new Request('http://localhost/meetups/next'))

    expect(core.fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
  })
})
