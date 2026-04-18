import { fetchHostedMeetupResponse } from '../meetups'

export async function handleMeetupBySlugRequest(slug: string): Promise<Response> {
  const response = await fetchHostedMeetupResponse(slug)

  if (!response) {
    return Response.json(
      {
        error: `Meetup "${slug}" was not found.`,
      },
      { status: 404 },
    )
  }

  return Response.json(response)
}
