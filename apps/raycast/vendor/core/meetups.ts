import { getMeetupEndsAt, getMeetupLifecycleStatus, getMeetupSlug, getMeetupSortTimestamp } from './meetup-derived'
import type { Meetup, MeetupProvider } from './types'

export function compareMeetupsAscending(left: Meetup, right: Meetup): number {
  return getMeetupSortTimestamp(left) - getMeetupSortTimestamp(right)
}

export function sortMeetupsAscending(meetups: Meetup[]): Meetup[] {
  return [...meetups].sort(compareMeetupsAscending)
}

function nowUtc(): number {
  return Date.now()
}

export function isPastMeetup(meetup: Meetup, now = nowUtc()): boolean {
  const endsAt = getMeetupEndsAt(meetup)
  const rawStatus = meetup.status.trim().toLowerCase()
  return (
    rawStatus === 'canceled'
    || rawStatus === 'cancelled'
    || Boolean(endsAt && Date.parse(endsAt) < now)
    || getMeetupLifecycleStatus(meetup) === 'completed'
  )
}

export async function getSortedMeetups(provider: MeetupProvider): Promise<Meetup[]> {
  return sortMeetupsAscending(await provider.listMeetups())
}

export async function getCurrentOrNextMeetup(provider: MeetupProvider): Promise<Meetup | undefined> {
  const meetups = await getSortedMeetups(provider)
  const now = nowUtc()

  return meetups.find((meetup) => !isPastMeetup(meetup, now))
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

  const meetup = await provider.getMeetupBySlug(slugOrKeyword)
  if (meetup) {
    return meetup
  }

  const meetups = await provider.listMeetups()
  return meetups.find((candidate) => getMeetupSlug(candidate) === slugOrKeyword || candidate.id === slugOrKeyword)
}
