import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrapeCodersMuMeetups } from '../src/providers/codersmu-scraper'

function encodeDataPage(payload: unknown): string {
  return JSON.stringify(payload)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createHtml(payload: unknown): string {
  return `<div data-page="${encodeDataPage(payload)}"></div>`
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('scrapeCodersMuMeetups', () => {
  it('normalizes a meetup from the index and detail pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(createHtml({
        props: {
          meetups: [
            {
              id: 'future-meetup',
              title: 'The Test Meetup',
              date: '2099-04-18',
            },
          ],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(createHtml({
        props: {
          meetup: {
            id: 'future-meetup',
            title: 'The Test Meetup',
            description: '<p>Hello <strong>Coders.mu</strong></p>',
            date: '2099-04-18',
            startTime: '10:00',
            endTime: '14:00',
            venue: 'The Venue',
            location: 'Vivea Business Park',
            acceptingRsvp: true,
            seatsAvailable: 12,
            rsvpLink: 'https://coders.mu/rsvp/future-meetup',
            mapUrl: 'https://maps.example.com/future-meetup',
            parkingLocation: 'https://parking.example.com/future-meetup',
          },
          rsvpCount: 7,
        },
      }), { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await scrapeCodersMuMeetups()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://coders.mu/meetups/')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://coders.mu/meetup/future-meetup')
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)

    expect(cache.source).toBe('https://coders.mu/meetups/')
    expect(cache.meetups).toHaveLength(1)
    expect(cache.meetups[0]).toMatchObject({
      id: 'future-meetup',
      slug: '2099-04-18-the-test-meetup',
      title: 'The Test Meetup',
      summary: 'Hello Coders.mu',
      status: 'scheduled',
      location: {
        name: 'The Venue',
        address: 'Vivea Business Park',
      },
      seatsAvailable: 12,
      rsvpCount: 7,
      acceptingRsvp: true,
      links: {
        meetup: 'https://coders.mu/meetup/future-meetup',
        rsvp: 'https://coders.mu/rsvp/future-meetup',
        map: 'https://maps.example.com/future-meetup',
        parking: 'https://parking.example.com/future-meetup',
      },
    })
  })

  it('turns fetch timeouts into a bounded error', async () => {
    const timeoutError = new Error('timed out')
    timeoutError.name = 'TimeoutError'

    const fetchMock = vi.fn().mockRejectedValue(timeoutError)
    vi.stubGlobal('fetch', fetchMock)

    await expect(scrapeCodersMuMeetups()).rejects.toThrow(
      'Request timed out for https://coders.mu/meetups/ after 10000ms.',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
