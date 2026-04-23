export interface MeetupSpeaker {
  id: string
  name: string
  githubUsername?: string | null
  avatarUrl?: string | null
  featured?: number | null
}

export interface MeetupSession {
  id: string
  title: string
  description?: string | null
  durationMinutes?: number | null
  order?: number | null
  speakers: MeetupSpeaker[]
}

export interface MeetupSponsor {
  id: string
  name: string
  website?: string | null
  logoUrl?: string | null
  sponsorTypes: string[]
  logoBg?: string | null
  status?: string | null
}

export interface MeetupPhoto {
  [key: string]: unknown
}

export interface Meetup {
  id: string
  slug?: string | null
  title: string
  description?: string | null
  date: string | null
  startTime?: string | null
  endTime?: string | null
  venue?: string | null
  location?: string | null
  status: string
  album?: string | null
  updatedAt?: string | null
  coverImageUrl?: string | null
  photos: MeetupPhoto[]
  sessions: MeetupSession[]
  sponsors: MeetupSponsor[]
  attendeeCount?: number
  seatsAvailable?: number | null
  capacityTotal?: number | null
  rsvpCount?: number | null
  seatsRemaining?: number | null
  acceptingRsvp?: number | null
  rsvpClosingDate?: string | null
  rsvpLink?: string | null
  mapUrl?: string | null
  parkingLocation?: string | null
}

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
