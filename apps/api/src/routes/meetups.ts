import { fetchHostedMeetupListResponse } from '../meetups'

const validStates = new Set(['upcoming', 'past', 'all'] as const)

export async function handleMeetupListRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const requestedState = url.searchParams.get('state') ?? 'all'

  if (!validStates.has(requestedState as 'upcoming' | 'past' | 'all')) {
    return Response.json(
      {
        error: `Unsupported meetup list state "${requestedState}". Expected one of: upcoming, past, all.`,
      },
      { status: 400 },
    )
  }

  const response = await fetchHostedMeetupListResponse(requestedState as 'upcoming' | 'past' | 'all')
  return Response.json(response)
}
