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
  meetups: import('@codersmu/contracts').Meetup[]
}

export interface MeetupProvider {
  listMeetups(): Promise<import('@codersmu/contracts').Meetup[]>
  getMeetupBySlug(slug: string): Promise<import('@codersmu/contracts').Meetup | undefined>
}

export type MeetupListState = 'upcoming' | 'past' | 'all'
