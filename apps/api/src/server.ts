import { createServer } from 'node:http'

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
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 })
  }

  const url = new URL(request.url)
  const pathname = normalizePathname(url.pathname)

  try {
    if (pathname === '/health') {
      return Response.json({ ok: true })
    }

    if (pathname === '/meetups') {
      return handleMeetupListRequest(request)
    }

    if (pathname === '/meetups/next') {
      return handleNextMeetupRequest()
    }

    if (pathname.startsWith('/meetups/')) {
      const slug = decodeURIComponent(pathname.slice('/meetups/'.length))
      return handleMeetupBySlugRequest(slug)
    }

    return Response.json({ error: 'Not found.' }, { status: 404 })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return Response.json({ error: message }, { status: 500 })
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

    const body = response.body ? Buffer.from(await response.arrayBuffer()) : null
    res.end(body ?? undefined)
  })

  server.listen(port, () => {
    console.log(`Coders.mu API listening on http://localhost:${port}`)
  })
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) {
  void startServer()
}
