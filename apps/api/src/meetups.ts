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

import { logEvent } from './logger'

const API_CACHE_TTL_MS = 60_000
const DEFAULT_UPSTREAM_API_BASE_URL = 'https://coders.mu/api/public/v1'

let cachedProvider: CacheMeetupProvider | undefined
let cachedProviderExpiresAt = 0
let providerLoadPromise: Promise<CacheMeetupProvider> | undefined

function resolveUpstreamApiBaseUrl(): string {
  return (process.env.CODERSMU_UPSTREAM_API_BASE_URL ?? DEFAULT_UPSTREAM_API_BASE_URL).replace(/\/+$/, '')
}

async function loadProvider(): Promise<CacheMeetupProvider> {
  const upstreamApiBaseUrl = resolveUpstreamApiBaseUrl()
  const startedAt = Date.now()

  logEvent('info', 'provider_refresh_started', {
    upstreamApiBaseUrl,
    cacheTtlMs: API_CACHE_TTL_MS,
  })

  const cache = await fetchFrontendMuMeetups({
    apiBaseUrl: upstreamApiBaseUrl,
    onDetailFailure: (meetupId, error) => {
      logEvent('warn', 'provider_detail_fetch_failed', {
        meetupId,
        upstreamApiBaseUrl,
        error,
      })
    },
  })

  logEvent('info', 'provider_refresh_succeeded', {
    upstreamApiBaseUrl,
    durationMs: Date.now() - startedAt,
    meetupCount: cache.meetups.length,
    scrapedAt: cache.scrapedAt,
  })

  return new CacheMeetupProvider(cache)
}

async function buildProvider(now = Date.now()): Promise<CacheMeetupProvider> {
  if (cachedProvider && cachedProviderExpiresAt > now) {
    logEvent('info', 'provider_cache_hit', {
      expiresInMs: cachedProviderExpiresAt - now,
    })
    return cachedProvider
  }

  if (!providerLoadPromise) {
    logEvent('info', 'provider_refresh_requested', {
      hasCachedProvider: Boolean(cachedProvider),
      cachedProviderExpired: Boolean(cachedProvider && cachedProviderExpiresAt <= now),
    })

    providerLoadPromise = loadProvider()
      .then((provider) => {
        cachedProvider = provider
        cachedProviderExpiresAt = Date.now() + API_CACHE_TTL_MS
        logEvent('info', 'provider_cache_updated', {
          expiresAt: new Date(cachedProviderExpiresAt).toISOString(),
        })
        return provider
      })
      .catch((error) => {
        logEvent('error', 'provider_refresh_failed', {
          error,
          hasCachedProvider: Boolean(cachedProvider),
        })

        if (cachedProvider) {
          cachedProviderExpiresAt = Date.now() + API_CACHE_TTL_MS
          logEvent('warn', 'provider_stale_cache_reused', {
            error,
            expiresAt: new Date(cachedProviderExpiresAt).toISOString(),
          })
          return cachedProvider
        }

        throw error
      })
      .finally(() => {
        providerLoadPromise = undefined
      })
  }
  else {
    logEvent('info', 'provider_refresh_joined', {
      hasCachedProvider: Boolean(cachedProvider),
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
