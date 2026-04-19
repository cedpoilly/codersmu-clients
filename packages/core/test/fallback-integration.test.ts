import type { AddressInfo } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { refreshDefaultMeetupCache } from '../src/client'

interface MockServer {
  url: string
  requests: Array<{ method: string, path: string }>
  stop: () => Promise<void>
}

interface MockServerOptions {
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

async function startMockServer(options: MockServerOptions): Promise<MockServer> {
  const requests: Array<{ method: string, path: string }> = []
  const server: Server = createServer(async (req, res) => {
    requests.push({ method: req.method ?? 'GET', path: req.url ?? '/' })
    try {
      await options.handler(req, res)
    }
    catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(`handler threw: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address() as AddressInfo
  const url = `http://127.0.0.1:${address.port}`

  return {
    url,
    requests,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const SAMPLE_UPSTREAM_MEETUP = {
  id: 'upstream-meetup',
  title: 'Upstream Meetup',
  description: 'from frontendmu',
  date: '2099-04-18',
  startTime: '10:00',
  endTime: '14:00',
  venue: 'Upstream Venue',
  location: 'Upstream Location',
  status: 'published',
  acceptingRsvp: 1,
}

const SAMPLE_HOSTED_MEETUP = {
  id: 'hosted-meetup',
  title: 'Hosted Meetup',
  description: 'from hosted API',
  date: '2099-04-18',
  startTime: '10:00',
  endTime: '14:00',
  venue: 'Hosted Venue',
  location: 'Hosted Location',
  status: 'published',
  photos: [],
  sessions: [],
  sponsors: [],
  acceptingRsvp: 1,
  seatsAvailable: null,
}

describe('client fallback chain (real HTTP)', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'codersmu-fallback-'))
    process.env.CODERSMU_CACHE_FILE = join(cacheDir, 'meetups.json')
  })

  afterEach(async () => {
    delete process.env.CODERSMU_CACHE_FILE
    delete process.env.CODERSMU_HOSTED_API_BASE_URL
    delete process.env.CODERSMU_API_BASE_URL
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('prefers the hosted API when it is healthy', async () => {
    const hosted = await startMockServer({
      handler: (_req, res) => {
        sendJson(res, 200, { meetups: [SAMPLE_HOSTED_MEETUP] })
      },
    })
    const upstream = await startMockServer({
      handler: (_req, res) => {
        sendJson(res, 500, { error: 'should not be called' })
      },
    })

    process.env.CODERSMU_HOSTED_API_BASE_URL = hosted.url
    process.env.CODERSMU_API_BASE_URL = upstream.url

    try {
      const { cache } = await refreshDefaultMeetupCache()
      expect(cache.meetups).toHaveLength(1)
      expect(cache.meetups[0]?.id).toBe('hosted-meetup')
      expect(cache.source).toBe(`${hosted.url}/meetups`)
      expect(upstream.requests).toHaveLength(0)
      expect(hosted.requests[0]?.path).toBe('/meetups?state=all')
    }
    finally {
      await hosted.stop()
      await upstream.stop()
    }
  })

  it('falls through to the upstream API when the hosted API returns 500', async () => {
    const hosted = await startMockServer({
      handler: (_req, res) => {
        sendJson(res, 500, { error: 'Internal server error.' })
      },
    })
    const upstream = await startMockServer({
      handler: (req, res) => {
        if (req.url === '/meetups') {
          sendJson(res, 200, [SAMPLE_UPSTREAM_MEETUP])
          return
        }
        if (req.url === `/meetups/${SAMPLE_UPSTREAM_MEETUP.id}`) {
          sendJson(res, 200, SAMPLE_UPSTREAM_MEETUP)
          return
        }
        sendJson(res, 404, { error: 'not found' })
      },
    })

    process.env.CODERSMU_HOSTED_API_BASE_URL = hosted.url
    process.env.CODERSMU_API_BASE_URL = upstream.url

    try {
      const { cache } = await refreshDefaultMeetupCache()
      expect(cache.meetups).toHaveLength(1)
      expect(cache.meetups[0]?.id).toBe('upstream-meetup')
      expect(hosted.requests).toHaveLength(1)
      expect(upstream.requests.length).toBeGreaterThanOrEqual(1)
    }
    finally {
      await hosted.stop()
      await upstream.stop()
    }
  })

  it('throws a combined error when both hosted and upstream fail', async () => {
    const hosted = await startMockServer({
      handler: (_req, res) => {
        sendJson(res, 503, { error: 'hosted down' })
      },
    })
    const upstream = await startMockServer({
      handler: (_req, res) => {
        sendJson(res, 502, { error: 'upstream down' })
      },
    })

    process.env.CODERSMU_HOSTED_API_BASE_URL = hosted.url
    process.env.CODERSMU_API_BASE_URL = upstream.url

    try {
      await expect(refreshDefaultMeetupCache()).rejects.toThrow(/Hosted.*API.*fallback/)
      expect(hosted.requests).toHaveLength(1)
      expect(upstream.requests.length).toBeGreaterThanOrEqual(1)
    }
    finally {
      await hosted.stop()
      await upstream.stop()
    }
  })

  it('falls through when the hosted API host is unreachable (connection refused)', async () => {
    const upstream = await startMockServer({
      handler: (req, res) => {
        if (req.url === '/meetups') {
          sendJson(res, 200, [SAMPLE_UPSTREAM_MEETUP])
          return
        }
        if (req.url === `/meetups/${SAMPLE_UPSTREAM_MEETUP.id}`) {
          sendJson(res, 200, SAMPLE_UPSTREAM_MEETUP)
          return
        }
        sendJson(res, 404, { error: 'not found' })
      },
    })

    // Bind an ephemeral port then release it so the hosted URL resolves to a
    // refused connection rather than a live server.
    const blackhole = await startMockServer({ handler: () => undefined })
    const refusedUrl = blackhole.url
    await blackhole.stop()

    process.env.CODERSMU_HOSTED_API_BASE_URL = refusedUrl
    process.env.CODERSMU_API_BASE_URL = upstream.url

    try {
      const { cache } = await refreshDefaultMeetupCache()
      expect(cache.meetups[0]?.id).toBe('upstream-meetup')
    }
    finally {
      await upstream.stop()
    }
  })
})
