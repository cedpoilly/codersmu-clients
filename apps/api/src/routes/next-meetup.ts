import { fetchHostedNextMeetupResponse } from '../meetups'

export async function handleNextMeetupRequest(): Promise<Response> {
  const response = await fetchHostedNextMeetupResponse()
  return Response.json(response)
}
