import { isMeetupCacheFresh, readMeetupCache, writeMeetupCache } from './cache'
import { getMeetup, getPastMeetups, getSortedMeetups, getUpcomingMeetups } from './meetups'
import { CacheMeetupProvider } from './providers/cache-provider'
import { scrapeCodersMuMeetups } from './providers/codersmu-scraper'
import type { Meetup, MeetupCache, MeetupListState, MeetupProvider } from './types'

interface ResolveDefaultMeetupProviderOptions {
  forceRefresh?: boolean
  allowStaleOnError?: boolean
}

export type DefaultMeetupQueryOptions = ResolveDefaultMeetupProviderOptions

function sortMeetupsAscending(meetups: Meetup[]): Meetup[] {
  return [...meetups].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
}

export async function resolveDefaultMeetupProvider(options?: ResolveDefaultMeetupProviderOptions): Promise<MeetupProvider> {
  const cached = await readMeetupCache()
  const shouldForceRefresh = options?.forceRefresh ?? process.env.CODERSMU_FORCE_REFRESH === '1'
  const allowStaleOnError = options?.allowStaleOnError ?? !shouldForceRefresh

  if (cached && !shouldForceRefresh && isMeetupCacheFresh(cached)) {
    return new CacheMeetupProvider(cached)
  }

  try {
    const cache = await scrapeCodersMuMeetups()
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
  const cache = await scrapeCodersMuMeetups()
  const cacheFile = await writeMeetupCache(cache)
  return { cache, cacheFile }
}

export async function fetchMeetup(selector: string, options?: DefaultMeetupQueryOptions): Promise<Meetup | undefined> {
  const provider = await resolveDefaultMeetupProvider(options)
  return provider.getMeetupBySlug(selector)
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

  const now = Date.now()
  return sortMeetupsAscending(await provider.listMeetups())
    .filter((meetup) => Date.parse(meetup.endsAt) >= now)
}
