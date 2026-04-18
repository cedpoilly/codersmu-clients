import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import type { MeetupCache } from './types'

const DEFAULT_CACHE_FILE = join(homedir(), '.codersmu', 'meetups.json')
const DEFAULT_BUSINESS_HOURS_TTL_MS = 60 * 60 * 1000
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const DEFAULT_BUSINESS_HOURS_START_HOUR = 9
const DEFAULT_BUSINESS_HOURS_END_HOUR = 18
const DEFAULT_BUSINESS_HOURS_TIMEZONE = 'Indian/Mauritius'

export function getCacheFilePath(): string {
  return process.env.CODERSMU_CACHE_FILE || DEFAULT_CACHE_FILE
}

function parseHour(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback
  }

  const parsed = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback
}

function isWithinBusinessHours(date: Date, calendar = DEFAULT_BUSINESS_HOURS_TIMEZONE): boolean {
  const hour = Number.parseInt(new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: calendar,
  }).format(date), 10)

  const startHour = parseHour(process.env.CODERSMU_BUSINESS_HOURS_START_HOUR, DEFAULT_BUSINESS_HOURS_START_HOUR)
  const endHour = parseHour(process.env.CODERSMU_BUSINESS_HOURS_END_HOUR, DEFAULT_BUSINESS_HOURS_END_HOUR)

  if (startHour === endHour) {
    return false
  }

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour
  }

  return hour >= startHour || hour < endHour
}

export function getCacheTtlMs(now = new Date()): number {
  const rawValue = process.env.CODERSMU_CACHE_TTL_MS
  if (!rawValue) {
    return isWithinBusinessHours(now) ? DEFAULT_BUSINESS_HOURS_TTL_MS : DEFAULT_CACHE_TTL_MS
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
