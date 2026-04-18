import {
  CacheMeetupProvider,
  createMeetupListResponse,
  createMeetupResponse,
  createNextMeetupResponse,
  fetchFrontendMuMeetups,
  getCurrentOrNextMeetup,
  getMeetupsForList,
} from '@codersmu/core'
import type { MeetupListState, MeetupListResponse, MeetupResponse, NextMeetupResponse } from '@codersmu/core'

const API_CACHE_TTL_MS = 60_000
const DEFAULT_UPSTREAM_API_BASE_URL = 'https://coders.mu/api/public/v1'

let cachedProvider: CacheMeetupProvider | undefined
let cachedProviderExpiresAt = 0
let providerLoadPromise: Promise<CacheMeetupProvider> | undefined

function resolveUpstreamApiBaseUrl(): string {
  return (process.env.CODERSMU_UPSTREAM_API_BASE_URL ?? DEFAULT_UPSTREAM_API_BASE_URL).replace(/\/+$/, '')
}

async function loadProvider(): Promise<CacheMeetupProvider> {
  const cache = await fetchFrontendMuMeetups({
    apiBaseUrl: resolveUpstreamApiBaseUrl(),
  })
  return new CacheMeetupProvider(cache)
}

async function buildProvider(now = Date.now()): Promise<CacheMeetupProvider> {
  if (cachedProvider && cachedProviderExpiresAt > now) {
    return cachedProvider
  }

  if (!providerLoadPromise) {
    providerLoadPromise = loadProvider()
      .then((provider) => {
        cachedProvider = provider
        cachedProviderExpiresAt = Date.now() + API_CACHE_TTL_MS
        return provider
      })
      .catch((error) => {
        if (cachedProvider) {
          cachedProviderExpiresAt = Date.now() + API_CACHE_TTL_MS
          return cachedProvider
        }

        throw error
      })
      .finally(() => {
        providerLoadPromise = undefined
      })
  }

  return providerLoadPromise
}

export async function fetchHostedMeetupListResponse(state: MeetupListState): Promise<MeetupListResponse> {
  const provider = await buildProvider()
  const meetups = await getMeetupsForList(provider, state)
  return createMeetupListResponse(meetups)
}

export async function fetchHostedNextMeetupResponse(): Promise<NextMeetupResponse> {
  const provider = await buildProvider()
  const meetup = await getCurrentOrNextMeetup(provider)
  return createNextMeetupResponse(meetup)
}

export async function fetchHostedMeetupResponse(slug: string): Promise<MeetupResponse | null> {
  const provider = await buildProvider()
  const meetup = await provider.getMeetupBySlug(slug)
  return meetup ? createMeetupResponse(meetup) : null
}
