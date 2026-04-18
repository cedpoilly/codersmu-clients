import type { MeetupListResponse, MeetupResponse, NextMeetupResponse } from '@codersmu/contracts'

import { fetchMeetupBySelector, fetchMeetupList } from './client'
import type { Meetup, MeetupListState } from './types'
import type { DefaultMeetupQueryOptions } from './client'

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
