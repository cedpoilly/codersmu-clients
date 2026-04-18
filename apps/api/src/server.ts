import { createServer } from 'node:http'

import { logEvent } from './logger'
import { handleMeetupBySlugRequest } from './routes/meetup-by-slug'
import { handleMeetupListRequest } from './routes/meetups'
import { handleNextMeetupRequest } from './routes/next-meetup'

function normalizePathname(pathname: string): string {
  if (pathname === '/') {
    return pathname
  }

  return pathname.replace(/\/+$/, '')
}

export async function handleRequest(request: Request): Promise<Response> {
  const startedAt = Date.now()

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const response = Response.json({ error: 'Method not allowed.' }, { status: 405 })
    const url = new URL(request.url)
    logEvent('warn', 'request_completed', {
      method: request.method,
      pathname: normalizePathname(url.pathname),
      status: response.status,
      durationMs: Date.now() - startedAt,
    })
    return response
  }

  const url = new URL(request.url)
  const pathname = normalizePathname(url.pathname)
  let response: Response | undefined

  try {
    if (pathname === '/health') {
      response = Response.json({ ok: true })
      return response
    }

    if (pathname === '/meetups') {
      response = await handleMeetupListRequest(request)
      return response
    }

    if (pathname === '/meetups/next') {
      response = await handleNextMeetupRequest()
      return response
    }

    if (pathname.startsWith('/meetups/')) {
      const slug = decodeURIComponent(pathname.slice('/meetups/'.length))
      response = await handleMeetupBySlugRequest(slug)
      return response
    }

    response = Response.json({ error: 'Not found.' }, { status: 404 })
    return response
  }
  catch (error) {
    logEvent('error', 'request_failed', {
      method: request.method,
      pathname,
      durationMs: Date.now() - startedAt,
      error,
    })

    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    response = Response.json({ error: message }, { status: 500 })
    return response
  }
  finally {
    if (response) {
      logEvent(response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info', 'request_completed', {
        method: request.method,
        pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
      })
    }
  }
}

async function startServer() {
  const port = Number.parseInt(process.env.PORT ?? '8787', 10)

  const server = createServer(async (req, res) => {
    const origin = `http://${req.headers.host ?? 'localhost'}`
    const requestHeaders: [string, string][] = []

    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          requestHeaders.push([key, item])
        }
        continue
      }

      if (value) {
        requestHeaders.push([key, value])
      }
    }

    const request = new Request(new URL(req.url ?? '/', origin), {
      method: req.method ?? 'GET',
      headers: new Headers(requestHeaders),
    })

    const response = await handleRequest(request)
    res.statusCode = response.status

    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    const body = response.body ? Buffer.from(await response.arrayBuffer()) : null
    res.end(body ?? undefined)
  })

  server.listen(port, () => {
    logEvent('info', 'server_started', {
      port,
      url: `http://localhost:${port}`,
    })
  })
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  void startServer()
}
