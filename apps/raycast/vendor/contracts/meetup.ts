export type MeetupStatus = 'scheduled' | 'ongoing' | 'completed' | 'postponed' | 'canceled'

export interface MeetupSpeaker {
  name: string
  title?: string
  githubUsername?: string
  avatarUrl?: string | null
  featured?: boolean
}

export interface MeetupSession {
  title: string
  description?: string
  speakers: MeetupSpeaker[]
}

export interface MeetupSponsor {
  name: string
  website?: string
  sponsorTypes: string[]
}

export interface MeetupLocation {
  name: string
  address?: string
  city?: string
}

export interface MeetupLinks {
  meetup?: string
  recording?: string
  slides?: string
  map?: string
  parking?: string
  rsvp?: string
}

export interface Meetup {
  id: string
  slug: string
  title: string
  summary: string
  startsAt: string
  endsAt: string
  timezone: string
  status: MeetupStatus
  location: MeetupLocation
  speakers: MeetupSpeaker[]
  sessions: MeetupSession[]
  sponsors: MeetupSponsor[]
  tags?: string[]
  attendeeCount?: number
  seatsAvailable?: number | null
  rsvpCount?: number
  acceptingRsvp?: boolean
  links: MeetupLinks
}
