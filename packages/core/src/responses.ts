import { fetchMeetupBySelector, fetchMeetupList } from './client'
import type { DefaultMeetupQueryOptions } from './client'
import type { Meetup, MeetupListState } from './types'

export interface MeetupResponse {
  meetup: Meetup
}

export interface NextMeetupResponse {
  meetup: Meetup | null
}

export interface MeetupListResponse {
  meetups: Meetup[]
}

export function createMeetupResponse(meetup: Meetup): MeetupResponse {
  return { meetup }
}

export function createNextMeetupResponse(meetup: Meetup | undefined): NextMeetupResponse {
  return { meetup: meetup ?? null }
}

export function createMeetupListResponse(meetups: Meetup[]): MeetupListResponse {
  return { meetups }
}

export async function fetchMeetupResponse(
  selector: string,
  options?: DefaultMeetupQueryOptions,
): Promise<MeetupResponse | null> {
  const meetup = await fetchMeetupBySelector(selector, options)
  return meetup ? createMeetupResponse(meetup) : null
}

export async function fetchNextMeetupResponse(options?: DefaultMeetupQueryOptions): Promise<NextMeetupResponse> {
  const meetup = await fetchMeetupBySelector('next', options)
  return createNextMeetupResponse(meetup)
}

export async function fetchMeetupListResponse(
  state: MeetupListState,
  options?: DefaultMeetupQueryOptions,
): Promise<MeetupListResponse> {
  const meetups = await fetchMeetupList(state, options)
  return createMeetupListResponse(meetups)
}
