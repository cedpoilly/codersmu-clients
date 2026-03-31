import { isMeetupCacheFresh, readMeetupCache, writeMeetupCache } from './cache'
import { getPastMeetups, getSortedMeetups, getUpcomingMeetups } from './meetups'
import { CacheMeetupProvider } from './providers/cache-provider'
import { scrapeCodersMuMeetups } from './providers/codersmu-scraper'
import type { Meetup, MeetupCache, MeetupListState, MeetupProvider } from './types'

function sortMeetupsAscending(meetups: Meetup[]): Meetup[] {
  return [...meetups].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
}

export async function resolveDefaultMeetupProvider(options?: { forceRefresh?: boolean }): Promise<MeetupProvider> {
  const cached = await readMeetupCache()
  const shouldForceRefresh = options?.forceRefresh ?? process.env.CODERSMU_FORCE_REFRESH === '1'

  if (cached && !shouldForceRefresh && isMeetupCacheFresh(cached)) {
    return new CacheMeetupProvider(cached)
  }

  try {
    const cache = await scrapeCodersMuMeetups()
    await writeMeetupCache(cache)
    return new CacheMeetupProvider(cache)
  }
  catch (error) {
    if (cached) {
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
