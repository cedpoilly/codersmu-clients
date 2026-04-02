import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MeetupCache } from '../src/types'

const sampleCache: MeetupCache = {
  source: 'https://coders.mu/meetups/',
  scrapedAt: '2099-04-18T06:00:00.000Z',
  meetups: [
    {
      id: 'future-meetup',
      slug: '2099-04-18-the-future-meetup',
      title: 'The Future Meetup',
      summary: 'A sample meetup used in tests.',
      startsAt: '2099-04-18T06:00:00.000Z',
      endsAt: '2099-04-18T10:00:00.000Z',
      timezone: 'Indian/Mauritius',
      status: 'scheduled',
      location: {
        name: 'Test Venue',
        city: 'Moka',
      },
      speakers: [],
      sessions: [],
      sponsors: [],
      links: {
        meetup: 'https://coders.mu/meetup/future-meetup',
      },
    },
  ],
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('../src/cache')
  vi.doUnmock('../src/providers/codersmu-scraper')
})

async function loadClientModule(options: {
  cached?: MeetupCache
  isFresh?: boolean
  scraped?: MeetupCache | Error
} = {}) {
  const readMeetupCache = vi.fn().mockResolvedValue(options.cached)
  const writeMeetupCache = vi.fn().mockResolvedValue('/tmp/meetups.json')
  const isMeetupCacheFresh = vi.fn().mockReturnValue(options.isFresh ?? false)
  const scrapeCodersMuMeetups = options.scraped instanceof Error
    ? vi.fn().mockRejectedValue(options.scraped)
    : vi.fn().mockResolvedValue(options.scraped ?? sampleCache)

  vi.doMock('../src/cache', () => ({
    readMeetupCache,
    writeMeetupCache,
    isMeetupCacheFresh,
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
    scrapeCodersMuMeetups,
  }
}

describe('resolveDefaultMeetupProvider', () => {
  it('returns a fresh cache without scraping', async () => {
    const { client, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: true,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(scrapeCodersMuMeetups).not.toHaveBeenCalled()
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('falls back to stale cached data when background refresh fails', async () => {
    const scrapeError = new Error('network down')
    const { client, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      scraped: scrapeError,
    })

    const provider = await client.resolveDefaultMeetupProvider()

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
    expect(scrapeCodersMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('throws on forced refresh when the live scrape fails', async () => {
    const scrapeError = new Error('network down')
    const { client, scrapeCodersMuMeetups, writeMeetupCache } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      scraped: scrapeError,
    })

    await expect(client.resolveDefaultMeetupProvider({ forceRefresh: true })).rejects.toThrow('network down')
    expect(scrapeCodersMuMeetups).toHaveBeenCalledTimes(1)
    expect(writeMeetupCache).not.toHaveBeenCalled()
  })

  it('can explicitly allow stale fallback even during a forced refresh', async () => {
    const scrapeError = new Error('network down')
    const { client } = await loadClientModule({
      cached: sampleCache,
      isFresh: false,
      scraped: scrapeError,
    })

    const provider = await client.resolveDefaultMeetupProvider({
      forceRefresh: true,
      allowStaleOnError: true,
    })

    await expect(provider.listMeetups()).resolves.toEqual(sampleCache.meetups)
  })
})
