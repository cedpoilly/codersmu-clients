import { readMeetupCache } from '../core/cache'
import type { Meetup, MeetupCache, MeetupProvider } from '../types'

export class CacheMeetupProvider implements MeetupProvider {
  constructor(private readonly cache: MeetupCache) {}

  static async fromFile(): Promise<CacheMeetupProvider | undefined> {
    const cache = await readMeetupCache()
    if (!cache) {
      return undefined
    }

    return new CacheMeetupProvider(cache)
  }

  async listMeetups(): Promise<Meetup[]> {
    return this.cache.meetups
  }

  async getMeetupBySlug(slug: string): Promise<Meetup | undefined> {
    return this.cache.meetups.find((meetup) => meetup.slug === slug || meetup.id === slug)
  }
}
