import type { Meetup, MeetupProvider } from './types'

function compareAsc(left: Meetup, right: Meetup): number {
  return Date.parse(left.startsAt) - Date.parse(right.startsAt)
}

function nowUtc(): number {
  return Date.now()
}

export function isPastMeetup(meetup: Meetup, now = nowUtc()): boolean {
  return (
    Date.parse(meetup.endsAt) < now
    || meetup.status === 'completed'
    || meetup.status === 'canceled'
  )
}

export async function getSortedMeetups(provider: MeetupProvider): Promise<Meetup[]> {
  return [...await provider.listMeetups()].sort(compareAsc)
}

export async function getCurrentOrNextMeetup(provider: MeetupProvider): Promise<Meetup | undefined> {
  const meetups = await getSortedMeetups(provider)
  const now = nowUtc()

  return meetups.find((meetup) => meetup.status !== 'canceled' && Date.parse(meetup.endsAt) >= now)
}

export async function getUpcomingMeetups(provider: MeetupProvider): Promise<Meetup[]> {
  const now = nowUtc()
  return (await getSortedMeetups(provider))
    .filter((meetup) => !isPastMeetup(meetup, now))
}

export async function getPastMeetups(provider: MeetupProvider): Promise<Meetup[]> {
  const now = nowUtc()
  return (await getSortedMeetups(provider))
    .filter((meetup) => isPastMeetup(meetup, now))
    .reverse()
}

export async function getPreviousMeetup(provider: MeetupProvider): Promise<Meetup | undefined> {
  return (await getPastMeetups(provider))[0]
}

export async function getMeetup(provider: MeetupProvider, slugOrKeyword: string): Promise<Meetup | undefined> {
  if (slugOrKeyword === 'next' || slugOrKeyword === 'current') {
    return getCurrentOrNextMeetup(provider)
  }

  if (slugOrKeyword === 'previous' || slugOrKeyword === 'prev' || slugOrKeyword === 'last') {
    return getPreviousMeetup(provider)
  }

  return provider.getMeetupBySlug(slugOrKeyword)
}
