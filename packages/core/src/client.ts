import { isMeetupCacheFresh, readMeetupCache, writeMeetupCache } from './cache'
import { getMeetup, getPastMeetups, getUpcomingMeetups } from './meetups'
import { CacheMeetupProvider } from './providers/cache-provider'
import { fetchFrontendMuMeetups } from './providers/frontendmu-api'
import { scrapeCodersMuMeetups } from './providers/codersmu-scraper'
import type { Meetup, MeetupCache, MeetupListState, MeetupProvider } from './types'

interface ResolveDefaultMeetupProviderOptions {
  forceRefresh?: boolean
  allowStaleOnError?: boolean
}

export type DefaultMeetupQueryOptions = ResolveDefaultMeetupProviderOptions

async function fetchLiveMeetupCache(): Promise<MeetupCache> {
  try {
    return await fetchFrontendMuMeetups()
  }
  catch (apiError) {
    try {
      return await scrapeCodersMuMeetups()
    }
    catch (scrapeError) {
      throw new Error(
        `Coders.mu API request failed and scraper fallback also failed. API: ${
          apiError instanceof Error ? apiError.message : String(apiError)
        }. Scraper: ${
          scrapeError instanceof Error ? scrapeError.message : String(scrapeError)
        }`,
      )
    }
  }
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
