import { afterEach, describe, expect, it, vi } from 'vitest'

import { getCacheTtlMs } from '../src/cache'

describe('getCacheTtlMs', () => {
  afterEach(() => {
    delete process.env.CODERSMU_CACHE_TTL_MS
    delete process.env.CODERSMU_BUSINESS_HOURS_START_HOUR
    delete process.env.CODERSMU_BUSINESS_HOURS_END_HOUR
    vi.useRealTimers()
  })

  it('uses a one-hour ttl during business hours by default', () => {
    const ttl = getCacheTtlMs(new Date('2026-04-20T10:00:00+04:00'))
    expect(ttl).toBe(60 * 60 * 1000)
  })

  it('uses a six-hour ttl outside business hours by default', () => {
    const ttl = getCacheTtlMs(new Date('2026-04-20T20:00:00+04:00'))
    expect(ttl).toBe(6 * 60 * 60 * 1000)
  })

  it('honors an explicit cache ttl override', () => {
    process.env.CODERSMU_CACHE_TTL_MS = '900000'

    const ttl = getCacheTtlMs(new Date('2026-04-20T10:00:00+04:00'))
    expect(ttl).toBe(900000)
  })
})
