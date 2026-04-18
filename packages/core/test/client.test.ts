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
  vi.resetModules()
  vi.doUnmock('../src/cache')
  vi.doUnmock('../src/providers/frontendmu-api')
  vi.doUnmock('../src/providers/codersmu-scraper')
})

async function loadClientModule(options: {
  cached?: MeetupCache
  isFresh?: boolean
  api?: MeetupCache | Error
  scraped?: MeetupCache | Error
} = {}) {
  const readMeetupCache = vi.fn().mockResolvedValue(options.cached)
  const writeMeetupCache = vi.fn().mockResolvedValue('/tmp/meetups.json')
  const isMeetupCacheFresh = vi.fn().mockReturnValue(options.isFresh ?? false)
  const fetchFrontendMuMeetups = options.api instanceof Error
    ? vi.fn().mockRejectedValue(options.api)
    : vi.fn().mockResolvedValue(options.api ?? sampleCache)
  const scrapeCodersMuMeetups = options.scraped instanceof Error
    ? vi.fn().mockRejectedValue(options.scraped)
    : vi.fn().mockResolvedValue(options.scraped ?? sampleCache)

  vi.doMock('../src/cache', () => ({
    readMeetupCache,
    writeMeetupCache,
    isMeetupCacheFresh,
  }))

  vi.doMock('../src/providers/frontendmu-api', () => ({
    fetchFrontendMuMeetups,
  }))

  vi.doMock('../src/providers/codersmu-scraper', () => ({
    scrapeCodersMuMeetups,
  }))

  const client = await import('../src/client')

  return {
    client,
    readMeetupCache,
    writeMeetupCache,
    isMeetupCacheFresh,
    fetchFrontendMuMeetups,
    scrapeCodersMuMeetups,
  }
}

describe('resolveDefaultMeetupProvider', () => {
  it('returns a fresh cache without scraping', async () => {
    const { client, fetchFrontendMuMeetups, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: true,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetchFrontendMuMeetups).not.toHaveBeenCalled()
    expect(scrapeCodersMuMeetups).not.toHaveBeenCalled()
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('uses the public API before the scraper fallback', async () => {
    const apiCache: MeetupCache = {
      ...sampleCache,
      source: 'https://coders.mu/api/public/v1/meetups',
    }
    const { client, fetchFrontendMuMeetups, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      isFresh: false,
      api: apiCache,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(apiCache.meetups)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(scrapeCodersMuMeetups).not.toHaveBeenCalled()
    expect(writeMeetupCache).toHaveBeenCalledWith(apiCache)
  })

  it('falls back to the scraper when the public API fails', async () => {
    const apiError = new Error('api down')
    const { client, fetchFrontendMuMeetups, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      isFresh: false,
      api: apiError,
      scraped: sampleCache,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(scrapeCodersMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).toHaveBeenCalledWith(sampleCache)
  })

  it('falls back to stale cached data when all live refresh paths fail', async () => {
    const apiError = new Error('api down')
    const scrapeError = new Error('scraper down')
    const { client, fetchFrontendMuMeetups, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
      scraped: scrapeError,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(scrapeCodersMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('throws on forced refresh when the API and scraper both fail', async () => {
    const apiError = new Error('api down')
    const scrapeError = new Error('scraper down')
    const { client, fetchFrontendMuMeetups, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
      scraped: scrapeError,
    })

    await expect(client.resolveDefaultMeetupProvider({ forceRefresh: true })).rejects.toThrow(
      'Coders.mu API request failed and scraper fallback also failed.',
    )
    expect(fetchFrontendMuMeetups).toHaveBeenCalledTimes(1)
    expect(scrapeCodersMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('can explicitly allow stale fallback even during a forced refresh', async () => {
    const apiError = new Error('api down')
    const scrapeError = new Error('scraper down')
    const { client } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      api: apiError,
      scraped: scrapeError,
    })

    const provider = await client.resolveDefaultMeetupProvider({
      forceRefresh: true,
      allowStaleOnError: true,
    })

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
  })
})
