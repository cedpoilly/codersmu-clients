import { isMeetupCacheFresh, readMeetupCache, writeMeetupCache } from './cache'
import { getMeetup, getPastMeetups, getUpcomingMeetups } from './meetups'
import { CacheMeetupProvider } from './providers/cache-provider'
import { fetchFrontendMuMeetups } from './providers/frontendmu-api'
import type { Meetup, MeetupCache, MeetupListState, MeetupProvider } from './types'

const FETCH_TIMEOUT_MS = 10_000

interface ResolveDefaultMeetupProviderOptions {
  forceRefresh?: boolean
  allowStaleOnError?: boolean
}

export type DefaultMeetupQueryOptions = ResolveDefaultMeetupProviderOptions

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  return trimmed.replace(/\/+$/, '')
}

function getConfiguredHostedApiBaseUrl(): string | undefined {
  return normalizeBaseUrl(process.env.CODERSMU_HOSTED_API_BASE_URL)
}

async function fetchHostedMeetupCache(baseUrl: string): Promise<MeetupCache> {
  const response = await fetch(`${baseUrl}/meetups?state=all`, {
    headers: {
      accept: 'application/json',
      'user-agent': 'codersmu-clients/0.0.0-prototype.1 (+https://coders.mu)',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${baseUrl}/meetups: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json() as { meetups: Meetup[] }
  return {
    source: `${baseUrl}/meetups`,
    scrapedAt: new Date().toISOString(),
    meetups: payload.meetups,
  }
}

async function fetchLiveMeetupCache(): Promise<MeetupCache> {
  const hostedApiBaseUrl = getConfiguredHostedApiBaseUrl()

  if (hostedApiBaseUrl) {
    try {
      return await fetchHostedMeetupCache(hostedApiBaseUrl)
    }
    catch (hostedError) {
      try {
        return await fetchFrontendMuMeetups()
      }
      catch (apiError) {
        throw new Error(
          `Hosted Coders.mu API request failed and Frontend.mu API fallback also failed. Hosted: ${
            hostedError instanceof Error ? hostedError.message : String(hostedError)
          }. API: ${
            apiError instanceof Error ? apiError.message : String(apiError)
          }`,
        )
      }
    }
  }

  return fetchFrontendMuMeetups()
}

export async function resolveDefaultMeetupProvider(options?: ResolveDefaultMeetupProviderOptions): Promise<MeetupProvider> {
  const cached = await readMeetupCache()
  const shouldForceRefresh = options?.forceRefresh ?? process.env.CODERSMU_FORCE_REFRESH === '1'
  const allowStaleOnError = options?.allowStaleOnError ?? !shouldForceRefresh

  if (cached && !shouldForceRefresh && isMeetupCacheFresh(cached)) {
    return new CacheMeetupProvider(cached)
  }

  try {
    const cache = await fetchLiveMeetupCache()
    await writeMeetupCache(cache)
    return new CacheMeetupProvider(cache)
  }
  catch (error) {
    if (cached && allowStaleOnError) {
      return new CacheMeetupProvider(cached)
    }

    throw error
  }
}

export async function refreshDefaultMeetupCache(): Promise<{ cache: MeetupCache, cacheFile: string }> {
  const cache = await fetchLiveMeetupCache()
  const cacheFile = await writeMeetupCache(cache)
  return { cache, cacheFile }
}

export async function fetchMeetupBySelector(selector: string, options?: DefaultMeetupQueryOptions): Promise<Meetup | undefined> {
  const provider = await resolveDefaultMeetupProvider(options)
  return getMeetup(provider, selector)
}

export async function fetchMeetupList(state: MeetupListState, options?: DefaultMeetupQueryOptions): Promise<Meetup[]> {
  const provider = await resolveDefaultMeetupProvider(options)
  return getMeetupsForList(provider, state)
}

export async function fetchNextMeetup(options?: DefaultMeetupQueryOptions): Promise<Meetup | undefined> {
  return fetchMeetupBySelector('next', options)
}

export async function getMeetupsForList(provider: MeetupProvider, state: MeetupListState): Promise<Meetup[]> {
  if (state === 'past') {
    return getPastMeetups(provider)
  }

  if (state === 'all') {
    return [
      ...await getUpcomingMeetups(provider),
      ...await getPastMeetups(provider),
    ]
  }

  return getUpcomingMeetups(provider)
}
