import type { Meetup } from '@codersmu/contracts'

export type {
  Meetup,
  MeetupLinks,
  MeetupLocation,
  MeetupSession,
  MeetupSpeaker,
  MeetupSponsor,
  MeetupStatus,
} from '@codersmu/contracts'

export interface MeetupCache {
  source: string
  scrapedAt: string
  meetups: Meetup[]
}

export interface MeetupProvider {
  listMeetups(): Promise<Meetup[]>
  getMeetupBySlug(slug: string): Promise<Meetup | undefined>
}

export type MeetupListState = 'upcoming' | 'past' | 'all'
