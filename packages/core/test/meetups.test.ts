import { describe, expect, it } from 'vitest'

import { getCurrentOrNextMeetup, getPastMeetups, getUpcomingMeetups, isPastMeetup } from '../src/meetups'
import type { Meetup, MeetupProvider } from '../src/types'

function makeMeetup(overrides: Partial<Meetup> & Pick<Meetup, 'id' | 'startsAt' | 'endsAt' | 'status'>): Meetup {
  return {
    slug: overrides.id,
    title: overrides.id,
    summary: '',
    timezone: 'Indian/Mauritius',
    location: { name: 'TBA' },
    speakers: [],
    sessions: [],
    sponsors: [],
    links: {},
    ...overrides,
  } as Meetup
}

function provider(meetups: Meetup[]): MeetupProvider {
  return {
    listMeetups: async () => meetups,
    getMeetupBySlug: async (slug) => meetups.find((meetup) => meetup.slug === slug),
  }
}

describe('canceled meetup handling', () => {
  const future = '2099-04-18T06:00:00.000Z'
  const futureEnd = '2099-04-18T10:00:00.000Z'
  const later = '2099-05-01T06:00:00.000Z'
  const laterEnd = '2099-05-01T10:00:00.000Z'

  it('treats canceled future meetups as past', () => {
    const canceled = makeMeetup({ id: 'canceled', startsAt: future, endsAt: futureEnd, status: 'canceled' })
    expect(isPastMeetup(canceled)).toBe(true)
  })

  it('skips canceled meetups when picking the next/current meetup', async () => {
    const canceled = makeMeetup({ id: 'canceled', startsAt: future, endsAt: futureEnd, status: 'canceled' })
    const upcoming = makeMeetup({ id: 'upcoming', startsAt: later, endsAt: laterEnd, status: 'scheduled' })

    await expect(getCurrentOrNextMeetup(provider([canceled, upcoming]))).resolves.toMatchObject({ id: 'upcoming' })
  })

  it('moves canceled meetups out of upcoming and into past listings', async () => {
    const canceled = makeMeetup({ id: 'canceled', startsAt: future, endsAt: futureEnd, status: 'canceled' })
    const upcoming = makeMeetup({ id: 'upcoming', startsAt: later, endsAt: laterEnd, status: 'scheduled' })
    const meetups = [canceled, upcoming]

    await expect(getUpcomingMeetups(provider(meetups))).resolves.toMatchObject([{ id: 'upcoming' }])
    await expect(getPastMeetups(provider(meetups))).resolves.toMatchObject([{ id: 'canceled' }])
  })
})
