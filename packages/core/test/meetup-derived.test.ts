import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMeetupEndsAt, getMeetupLifecycleStatus, getMeetupLinks, getMeetupSlug, getMeetupStartsAt } from '../src/meetup-derived'
import type { Meetup } from '../src/types'

const baseMeetup: Meetup = {
  id: 'future-meetup',
  title: 'The Test Meetup',
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
}

describe('meetup-derived schedule helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not invent timestamps when the API omits startTime', () => {
    const dateOnlyMeetup: Meetup = {
      ...baseMeetup,
      startTime: null,
      endTime: null,
    }

    expect(getMeetupStartsAt(dateOnlyMeetup)).toBeUndefined()
    expect(getMeetupEndsAt(dateOnlyMeetup)).toBeUndefined()
    expect(getMeetupLifecycleStatus(dateOnlyMeetup)).toBe('scheduled')
  })

  it('still derives an end time when only the end time is missing', () => {
    const missingEndTime: Meetup = {
      ...baseMeetup,
      endTime: null,
    }

    expect(getMeetupStartsAt(missingEndTime)).toBe('2099-04-18T06:00:00.000Z')
    expect(getMeetupEndsAt(missingEndTime)).toBe('2099-04-18T10:00:00.000Z')
  })

  it('rolls overnight end times into the next day with a 24 hour shift', () => {
    const overnightMeetup: Meetup = {
      ...baseMeetup,
      startTime: '08:00',
      endTime: '07:00',
    }

    expect(getMeetupStartsAt(overnightMeetup)).toBe('2099-04-18T04:00:00.000Z')
    expect(getMeetupEndsAt(overnightMeetup)).toBe('2099-04-19T03:00:00.000Z')
  })

  it('marks date-only meetups as completed once their Mauritius date has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2099-04-19T08:00:00.000Z'))

    const dateOnlyMeetup: Meetup = {
      ...baseMeetup,
      startTime: null,
      endTime: null,
    }

    expect(getMeetupLifecycleStatus(dateOnlyMeetup)).toBe('completed')
  })

  it('falls back to the meetup page when RSVP is open but the upstream RSVP link is unsafe', () => {
    const unsafeMeetup: Meetup = {
      ...baseMeetup,
      acceptingRsvp: 1,
      rsvpLink: 'javascript:alert(1)',
      mapUrl: 'http://maps.example.com/meetup',
      parkingLocation: 'data:text/plain,hello',
    }

    expect(getMeetupLinks(unsafeMeetup)).toEqual({
      meetup: 'https://coders.mu/meetup/future-meetup',
      rsvp: 'https://coders.mu/meetup/future-meetup',
      map: undefined,
      parking: undefined,
    })
  })

  it('still drops an unsafe RSVP link when the meetup is not accepting RSVPs', () => {
    const closedMeetup: Meetup = {
      ...baseMeetup,
      acceptingRsvp: 0,
      rsvpLink: 'javascript:alert(1)',
    }

    expect(getMeetupLinks(closedMeetup)).toEqual({
      meetup: 'https://coders.mu/meetup/future-meetup',
      rsvp: undefined,
      map: undefined,
      parking: undefined,
    })
  })

  it('prefers the canonical API slug when one is provided', () => {
    const canonicalSlugMeetup: Meetup = {
      ...baseMeetup,
      slug: '2026-may',
    }

    expect(getMeetupSlug(canonicalSlugMeetup)).toBe('2026-may')
  })
})
