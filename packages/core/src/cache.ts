import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import type { MeetupCache } from './types'

const DEFAULT_CACHE_FILE = join(homedir(), '.codersmu', 'meetups.json')
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export function getCacheFilePath(): string {
  return process.env.CODERSMU_CACHE_FILE || DEFAULT_CACHE_FILE
}

export function getCacheTtlMs(): number {
  const rawValue = process.env.CODERSMU_CACHE_TTL_MS
  if (!rawValue) {
    return DEFAULT_CACHE_TTL_MS
  }

  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_CACHE_TTL_MS
}

export async function readMeetupCache(cacheFile = getCacheFilePath()): Promise<MeetupCache | undefined> {
  try {
    const content = await readFile(cacheFile, 'utf8')
    return JSON.parse(content) as MeetupCache
  }
  catch {
    return undefined
  }
}

export async function writeMeetupCache(cache: MeetupCache, cacheFile = getCacheFilePath()): Promise<string> {
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
  return cacheFile
}

export function isMeetupCacheFresh(cache: MeetupCache, ttlMs = getCacheTtlMs()): boolean {
  const scrapedAtMs = Date.parse(cache.scrapedAt)
  if (!Number.isFinite(scrapedAtMs)) {
    return false
  }

  return (Date.now() - scrapedAtMs) <= ttlMs
}
