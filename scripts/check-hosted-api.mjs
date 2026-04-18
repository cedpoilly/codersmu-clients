#!/usr/bin/env node

import assert from 'node:assert/strict'
import process from 'node:process'

const DEFAULT_HOSTED_API_BASE_URL = 'https://codersmu.lepopquiz.app'
const DEFAULT_TIMEOUT_SECONDS = 10
const USER_AGENT = 'codersmu-hosted-api-check/0.2 (+https://coders.mu)'

function readBaseUrl() {
  return (process.env.CODERSMU_HOSTED_API_BASE_URL || DEFAULT_HOSTED_API_BASE_URL).replace(/\/+$/, '')
}

function readTimeoutMilliseconds() {
  const rawValue = process.env.CODERSMU_HOSTED_API_TIMEOUT_SECONDS
  if (!rawValue) {
    return DEFAULT_TIMEOUT_SECONDS * 1000
  }

  const parsedValue = Number(rawValue)
  assert(Number.isFinite(parsedValue) && parsedValue > 0, 'CODERSMU_HOSTED_API_TIMEOUT_SECONDS must be a positive number.')
  return parsedValue * 1000
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replaceAll(/[\s_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

function getMeetupSlug(meetup) {
  if (typeof meetup.date === 'string' && meetup.date.slice(0, 10)) {
    return `${meetup.date.slice(0, 10)}-${slugify(String(meetup.title ?? ''))}`
  }

  return String(meetup.id)
}

function assertMeetupShape(meetup, label) {
  assert.equal(typeof meetup, 'object', `${label} must be an object.`)
  assert(meetup !== null, `${label} must not be null.`)
  assert.equal(typeof meetup.id, 'string', `${label}.id must be a string.`)
  assert(meetup.id.length > 0, `${label}.id must not be empty.`)
  assert.equal(typeof meetup.title, 'string', `${label}.title must be a string.`)
  assert(meetup.title.length > 0, `${label}.title must not be empty.`)
}

async function fetchResponse(baseUrl, path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: 'follow',
    signal: AbortSignal.timeout(readTimeoutMilliseconds()),
    headers: {
      accept: 'application/json',
      'user-agent': USER_AGENT,
      ...(init.headers ?? {}),
    },
  })

  assert(response.ok, `${init.method ?? 'GET'} ${path} returned ${response.status} ${response.statusText}.`)
  return response
}

async function fetchJson(baseUrl, path) {
  const response = await fetchResponse(baseUrl, path)
  const contentType = response.headers.get('content-type') ?? ''
  assert(contentType.includes('application/json'), `GET ${path} returned unexpected content type "${contentType}".`)

  const payload = await response.json()
  assert.equal(typeof payload, 'object', `GET ${path} must return a JSON object.`)
  assert(payload !== null, `GET ${path} must not return null.`)
  return payload
}

async function checkHealth(baseUrl) {
  const healthResponse = await fetchResponse(baseUrl, '/health')
  const healthContentType = healthResponse.headers.get('content-type') ?? ''
  assert(healthContentType.includes('application/json'), `GET /health returned unexpected content type "${healthContentType}".`)

  const healthPayload = await healthResponse.json()
  assert.equal(healthPayload.ok, true, '/health must return {"ok": true}.')
  const service = healthPayload.service
  if (service !== undefined) {
    assert.equal(typeof service, 'string', '/health service must be a string when present.')
    assert(service.length > 0, '/health service must not be empty when present.')
    assert.equal(healthResponse.headers.get('x-codersmu-service'), service, 'The health service header must match the payload when present.')
  }

  const version = healthPayload.version
  if (version !== undefined) {
    assert.equal(typeof version, 'string', '/health version must be a string when present.')
    assert(version.length > 0, '/health version must not be empty when present.')
    assert.equal(healthResponse.headers.get('x-codersmu-version'), version, 'The health version header must match the payload when present.')
  }

  const headResponse = await fetchResponse(baseUrl, '/health', {
    method: 'HEAD',
  })
  assert.equal(headResponse.status, 200, 'HEAD /health must return 200.')

  const releaseSha = healthPayload.releaseSha
  if (releaseSha !== undefined) {
    assert.equal(typeof releaseSha, 'string', '/health releaseSha must be a string when present.')
    assert(releaseSha.length > 0, '/health releaseSha must not be empty when present.')
    assert.equal(headResponse.headers.get('x-codersmu-release-sha'), releaseSha, 'The release-sha header must match the health payload when present.')
  }

  return {
    service,
    version,
    releaseSha,
  }
}

async function checkListAndDetail(baseUrl) {
  const listPayload = await fetchJson(baseUrl, '/meetups?state=all')
  assert(Array.isArray(listPayload.meetups), '/meetups?state=all must return a meetups array.')
  assert(listPayload.meetups.length > 0, '/meetups?state=all must return at least one meetup.')

  const ids = new Set()
  for (const meetup of listPayload.meetups) {
    assertMeetupShape(meetup, 'meetups[]')
    assert(!ids.has(meetup.id), `Duplicate meetup id "${meetup.id}" found in /meetups?state=all.`)
    ids.add(meetup.id)
  }

  const sampleMeetup = listPayload.meetups[0]
  const sampleSlug = encodeURIComponent(getMeetupSlug(sampleMeetup))
  const slugDetailPayload = await fetchJson(baseUrl, `/meetups/${sampleSlug}`)
  assertMeetupShape(slugDetailPayload.meetup, 'detail meetup')
  assert.equal(slugDetailPayload.meetup.id, sampleMeetup.id, 'Slug detail response must match the list meetup id.')

  const idDetailPayload = await fetchJson(baseUrl, `/meetups/${encodeURIComponent(sampleMeetup.id)}`)
  assertMeetupShape(idDetailPayload.meetup, 'id detail meetup')
  assert.equal(idDetailPayload.meetup.id, sampleMeetup.id, 'ID detail response must match the list meetup id.')

  return {
    allMeetups: listPayload.meetups,
    allMeetupIds: ids,
  }
}

async function checkUpcomingAndNext(baseUrl, allMeetupIds) {
  const upcomingPayload = await fetchJson(baseUrl, '/meetups?state=upcoming')
  assert(Array.isArray(upcomingPayload.meetups), '/meetups?state=upcoming must return a meetups array.')

  const upcomingIds = new Set()
  for (const meetup of upcomingPayload.meetups) {
    assertMeetupShape(meetup, 'upcoming meetups[]')
    upcomingIds.add(meetup.id)
  }

  const nextPayload = await fetchJson(baseUrl, '/meetups/next')
  assert(Object.hasOwn(nextPayload, 'meetup'), '/meetups/next must include a meetup key.')

  if (nextPayload.meetup === null) {
    return {
      upcomingCount: upcomingPayload.meetups.length,
      hasNextMeetup: false,
    }
  }

  assertMeetupShape(nextPayload.meetup, 'next meetup')
  assert(allMeetupIds.has(nextPayload.meetup.id), 'The next meetup must also appear in /meetups?state=all.')
  assert(upcomingIds.has(nextPayload.meetup.id), 'The next meetup must also appear in /meetups?state=upcoming.')

  return {
    upcomingCount: upcomingPayload.meetups.length,
    hasNextMeetup: true,
    nextMeetupId: nextPayload.meetup.id,
  }
}

async function main() {
  const baseUrl = readBaseUrl()

  const healthSummary = await checkHealth(baseUrl)
  const { allMeetups, allMeetupIds } = await checkListAndDetail(baseUrl)
  const nextSummary = await checkUpcomingAndNext(baseUrl, allMeetupIds)

  const nextLabel = nextSummary.hasNextMeetup
    ? `next=${nextSummary.nextMeetupId}`
    : 'next=none'
  const releaseLabel = healthSummary.releaseSha
    ? `release=${healthSummary.releaseSha}`
    : healthSummary.version
      ? `version=${healthSummary.version}`
      : 'version=unknown'
  const serviceLabel = healthSummary.service ?? 'service=unknown'

  console.log(
    `Hosted API is healthy at ${baseUrl} (${serviceLabel}, ${releaseLabel}, ${allMeetups.length} meetups, ${nextSummary.upcomingCount} upcoming, ${nextLabel})`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
