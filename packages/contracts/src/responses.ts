import type { Meetup } from './meetup'

export interface MeetupResponse {
  meetup: Meetup
}

export interface NextMeetupResponse {
  meetup: Meetup | null
}

export interface MeetupListResponse {
  meetups: Meetup[]
}
