import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MeetupCache } from '../src/types'

const sampleCache: MeetupCache = {
  source: 'https://coders.mu/meetups/',
  scrapedAt: '2099-04-18T06:00:00.000Z',
  meetups: [
    {
      id: 'future-meetup',
      title: 'The Future Meetup',
      description: 'A sample meetup used in tests.',
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

afterEach(() => {
  delete process.env.CODERSMU_HOSTED_API_BASE_URL
  vi.unstubAllGlobals()
  vi.resetModules()
  vi.doUnmock('../src/cache')
  vi.doUnmock('../src/providers/frontendmu-api')
})

async function loadClientModule(options: {
  cached?: MeetupCache
  isFresh?: boolean
  api?: MeetupCache | Error
} = {}) {
  const readMeetupCache = vi.fn().mockResolvedValue(options.cached)
  const writeMeetupCache = vi.fn().mockResolvedValue('/tmp/meetups.json')
  const isMeetupCacheFresh = vi.fn().mockReturnValue(options.isFresh ?? false)
  const fetchFrontendMuMeetups = options.api instanceof Error
    ? vi.fn().mockRejectedValue(options.api)
    : vi.fn().mockResolvedValue(options.api ?? sampleCache)

  vi.doMock('../src/cache', () => ({
    readMeetupCache,
    writeMeetupCache,
    isMeetupCacheFresh,
  }))

  vi.doMock('../src/providers/frontendmu-api', () => ({
    fetchFrontendMuMeetups,
  }))

  const client = await import('../src/client')

  return {
    client,
    readMeetupCache,
    writeMeetupCache,
    isMeetupCacheFresh,
    fetchFrontendMuMeetups,
  }
}

describe('resolveDefaultMeetupProvider', () => {
  it('returns a fresh cache without scraping', async () => {
    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: true,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetchFrontendMuMeetups).not.toHaveBeenCalled()
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('uses the public API when no hosted endpoint is configured', async () => {
    const apiCache: MeetupCache = {
      ...sampleCache,
      source: 'https://coders.mu/api/public/v1/meetups',
    }
    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      isFresh: false,
      api: apiCache,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(apiCache.meetups)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).toHaveBeenCalledWith(apiCache)
  })

  it('prefers the hosted meetup API when configured', async () => {
    process.env.CODERSMU_HOSTED_API_BASE_URL = 'https://api.coders.mu'
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      meetups: sampleCache.meetups,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }))
    vi.stubGlobal('fetch', fetch)

    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      isFresh: false,
      api: new Error('frontend api should not be called'),
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.coders.mu/meetups?state=all',
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: 'application/json',
        }),
      }),
    )
    expect(fetchFrontendMuMeetups).not.toHaveBeenCalled()
    expect(writeMeetupCache).toHaveBeenCalledWith(expect.objectContaining({
      source: 'https://api.coders.mu/meetups',
      meetups: sampleCache.meetups,
    }))
  })

  it('falls back from the hosted endpoint to the Frontend.mu API', async () => {
    process.env.CODERSMU_HOSTED_API_BASE_URL = 'https://api.coders.mu'
    const fetch = vi.fn().mockRejectedValue(new Error('hosted api down'))
    vi.stubGlobal('fetch', fetch)

    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      isFresh: false,
      api: sampleCache,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).toHaveBeenCalledWith(sampleCache)
  })

  it('falls back to stale cached data when the live API fetch fails', async () => {
    const apiError = new Error('api down')
    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('throws on forced refresh when the live API fetch fails', async () => {
    const apiError = new Error('api down')
    const { client, fetchFrontendMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
    })

    await expect(client.resolveDefaultMeetupProvider({ forceRefresh: true })).rejects.toThrow('api down')
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('can explicitly allow stale fallback even during a forced refresh', async () => {
    const apiError = new Error('api down')
    const { client } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
    })

    const provider = await client.resolveDefaultMeetupProvider({
      forceRefresh: true,
      allowStaleOnError: true,
    })

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
  })

  it('uses the shared upcoming selector for list filtering', async () => {
    const dateTbaMeetup: MeetupCache['meetups'][number] = {
      id: 'date-tba',
      title: 'Date TBA Meetup',
      description: 'Published without a start time yet.',
      date: '2099-04-17',
      startTime: null,
      endTime: null,
      venue: 'TBA',
      location: 'Mauritius',
      status: 'published',
      photos: [],
      sessions: [],
      sponsors: [],
      acceptingRsvp: 0,
      seatsAvailable: null,
    }
    const canceledMeetup: MeetupCache['meetups'][number] = {
      id: 'canceled-meetup',
      title: 'Canceled Meetup',
      description: 'Should not remain in the upcoming list.',
      date: '2099-04-18',
      startTime: '10:00',
      endTime: '14:00',
      venue: 'Test Venue',
      location: 'Moka',
      status: 'canceled',
      photos: [],
      sessions: [],
      sponsors: [],
      acceptingRsvp: 0,
      seatsAvailable: null,
    }
    const scheduledMeetup: MeetupCache['meetups'][number] = {
      ...sampleCache.meetups[0],
      id: 'scheduled-meetup',
      title: 'Scheduled Meetup',
    }

    const { client } = await loadClientModule({
      cached: {
        ...sampleCache,
        meetups: [canceledMeetup, scheduledMeetup, dateTbaMeetup],
      },
      isFresh: true,
    })

    await expect(client.fetchMeetupList('upcoming')).resolves.toMatchObject([
      { id: 'date-tba' },
      { id: 'scheduled-meetup' },
    ])
  })
})
