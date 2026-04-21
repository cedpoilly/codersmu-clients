import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchFrontendMuMeetups } from '../src/providers/frontendmu-api'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchFrontendMuMeetups', () => {
  it('normalizes the public API list and detail endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'future-meetup',
          slug: 'canonical-future-meetup',
          title: 'The Test Meetup',
          date: '2099-04-18',
          status: 'published',
          venue: 'The Venue',
          location: 'Vivea Business Park',
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'future-meetup',
        slug: 'canonical-future-meetup',
        title: 'The Test Meetup',
        description: '<p>Hello <strong>coders.mu</strong></p>',
        date: '2099-04-18',
        startTime: '10:00',
        endTime: '14:00',
        venue: 'The Venue',
        location: 'Vivea Business Park',
        status: 'published',
        acceptingRsvp: 1,
        seatsAvailable: 12,
        rsvpLink: 'https://coders.mu/rsvp/future-meetup',
        mapUrl: 'https://maps.example.com/future-meetup',
        parkingLocation: 'https://parking.example.com/future-meetup',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(`
        <div
          id="app"
          data-page="{&quot;props&quot;:{&quot;rsvpCount&quot;:5}}"
        ></div>
      `, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://coders.mu/api/public/v1/meetups')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://coders.mu/api/public/v1/meetups/future-meetup')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://coders.mu/meetup/future-meetup')
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)

    expect(cache.source).toBe('https://coders.mu/api/public/v1/meetups')
    expect(cache.meetups).toHaveLength(1)
    expect(cache.meetups[0]).toMatchObject({
      id: 'future-meetup',
      slug: 'canonical-future-meetup',
      title: 'The Test Meetup',
      description: '<p>Hello <strong>coders.mu</strong></p>',
      date: '2099-04-18',
      startTime: '10:00',
      endTime: '14:00',
      venue: 'The Venue',
      location: 'Vivea Business Park',
      status: 'published',
      seatsAvailable: 12,
      capacityTotal: 12,
      rsvpCount: 5,
      seatsRemaining: 7,
      acceptingRsvp: 1,
      rsvpLink: 'https://coders.mu/rsvp/future-meetup',
      mapUrl: 'https://maps.example.com/future-meetup',
      parkingLocation: 'https://parking.example.com/future-meetup',
      photos: [],
    })
  })

  it('falls back cleanly when the live API omits slug', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
        id: 'future-meetup',
        title: 'The Test Meetup',
        date: '2099-04-18',
        status: 'published',
      },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'future-meetup',
        title: 'The Test Meetup',
        description: null,
        date: '2099-04-18',
        startTime: '10:00',
        status: 'published',
      }), { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups()

    expect(cache.meetups[0]?.date).toBe('2099-04-18')
    expect(cache.meetups[0]?.id).toBe('future-meetup')
    expect(cache.meetups[0]?.slug).toBeNull()
  })

  it('supports overriding the upstream API base URL', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'future-meetup',
          title: 'The Test Meetup',
          date: '2099-04-18',
          status: 'published',
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'future-meetup',
        title: 'The Test Meetup',
        description: null,
        date: '2099-04-18',
        status: 'published',
      }), { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups({
      apiBaseUrl: 'https://frontendmu.example/api/public/v1/',
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://frontendmu.example/api/public/v1/meetups')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://frontendmu.example/api/public/v1/meetups/future-meetup')
    expect(cache.source).toBe('https://frontendmu.example/api/public/v1/meetups')
  })

  it('normalizes cancelled statuses to canceled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'canceled-meetup',
          title: 'Canceled Meetup',
          date: '2099-04-18',
          status: 'cancelled',
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'canceled-meetup',
        title: 'Canceled Meetup',
        description: null,
        date: '2099-04-18',
        status: 'cancelled',
      }), { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups()

    expect(cache.meetups[0]?.status).toBe('canceled')
  })

  it('keeps usable index meetups when one detail endpoint fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'future-meetup',
          title: 'The Detailed Meetup',
          date: '2099-04-18',
          status: 'published',
        },
        {
          id: 'broken-meetup',
          title: 'The Broken Meetup',
          date: '2099-04-25',
          status: 'published',
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'future-meetup',
        title: 'The Detailed Meetup',
        description: 'Full details',
        date: '2099-04-18',
        startTime: '10:00',
        status: 'published',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('missing', { status: 404, statusText: 'Not Found' }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups()

    expect(cache.meetups).toHaveLength(2)
    expect(cache.meetups[0]).toMatchObject({
      id: 'future-meetup',
      description: 'Full details',
      startTime: '10:00',
    })
    expect(cache.meetups[1]).toMatchObject({
      id: 'broken-meetup',
      title: 'The Broken Meetup',
      date: '2099-04-25',
      status: 'published',
    })
  })

  it('computes explicit remaining seats from page RSVP metadata when the API omits it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        {
          id: 'future-meetup',
          title: 'The Test Meetup',
          date: '2099-04-18',
          status: 'published',
        },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'future-meetup',
        title: 'The Test Meetup',
        date: '2099-04-18',
        status: 'published',
        seatsAvailable: 30,
        rsvpCount: null,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(`
        <div
          id="app"
          data-page="{&quot;props&quot;:{&quot;rsvpCount&quot;:5}}"
        ></div>
      `, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const cache = await fetchFrontendMuMeetups()

    expect(cache.meetups[0]).toMatchObject({
      seatsAvailable: 30,
      capacityTotal: 30,
      rsvpCount: 5,
      seatsRemaining: 25,
    })
  })

  it('turns fetch timeouts into a bounded error', async () => {
    const timeoutError = new Error('timed out')
    timeoutError.name = 'TimeoutError'

    const fetchMock = vi.fn().mockRejectedValue(timeoutError)
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchFrontendMuMeetups()).rejects.toThrow(
      'Request timed out for https://coders.mu/api/public/v1/meetups after 10000ms.',
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
