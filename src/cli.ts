#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { parseArgs } from 'node:util'

import { isMeetupCacheFresh, readMeetupCache, writeMeetupCache } from './core/cache'
import { getCurrentOrNextMeetup, getMeetup, getPastMeetups, getSortedMeetups } from './core/meetups'
import { CacheMeetupProvider } from './providers/cache-provider'
import { scrapeCodersMuMeetups } from './providers/codersmu-scraper'
import type { Meetup, MeetupCache, MeetupProvider, MeetupSession, MeetupSpeaker } from './types'

type MeetupListState = 'upcoming' | 'past' | 'all'

interface CliOptions {
  json: boolean
  short: boolean
  write?: string
  state?: string
  limit?: string
}

const COLORS = {
  reset: '\x1B[0m',
  dim: '\x1B[2m',
  cyan: '\x1B[36m',
  yellow: '\x1B[33m',
  bold: '\x1B[1m',
}

function colorize(color: keyof typeof COLORS, value: string): string {
  return `${COLORS[color]}${value}${COLORS.reset}`
}

function formatMeetupDate(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-MU', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function formatMeetupDay(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

function formatMeetupRange(meetup: Meetup): string {
  const endDate = new Date(meetup.endsAt)
  const startDate = new Date(meetup.startsAt)
  const sameLocalDay = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: meetup.timezone,
  }).format(startDate) === new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: meetup.timezone,
  }).format(endDate)

  const endLabel = sameLocalDay
    ? new Intl.DateTimeFormat('en-MU', {
        timeStyle: 'short',
        timeZone: meetup.timezone,
      }).format(endDate)
    : formatMeetupDate(meetup.endsAt, meetup.timezone)

  return `${formatMeetupDate(meetup.startsAt, meetup.timezone)} to ${endLabel}`
}

function wrapText(value: string, width = 72): string[] {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length > width && currentLine) {
      lines.push(currentLine)
      currentLine = word
      continue
    }
    currentLine = candidate
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function joinParts(parts: Array<string | undefined | null>): string {
  const seen = new Set<string>()
  const cleaned = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })

  return cleaned.join(', ')
}

function printBlock(title: string, lines: string[]): void {
  if (!lines.length) {
    return
  }

  console.log(colorize('bold', title))
  for (const line of lines) {
    console.log(line)
  }
  console.log()
}

function renderMeetupCard(meetup: Meetup): void {
  console.log(colorize('bold', meetup.title))
  console.log(colorize('cyan', meetup.slug))
  console.log(formatMeetupRange(meetup))
  console.log(joinParts([meetup.location.name, meetup.location.address, meetup.location.city]) || 'Location TBA')
  console.log(colorize('dim', meetup.summary))
  console.log()
}

function renderMeetupShortLine(meetup: Meetup): void {
  const location = joinParts([meetup.location.name, meetup.location.city]) || meetup.location.name || 'TBA'
  console.log(`${formatMeetupDay(meetup.startsAt, meetup.timezone)}  ${meetup.title}  (${meetup.slug})  ${location}`)
}

function buildCalendarUrls(meetup: Meetup): { google: string, outlook: string } {
  const title = encodeURIComponent(meetup.title)
  const detailsSource = meetup.links.meetup
    ? `${meetup.summary}\n\nMore details: ${meetup.links.meetup}`
    : meetup.summary
  const details = encodeURIComponent(detailsSource)
  const location = encodeURIComponent(joinParts([meetup.location.name, meetup.location.address, meetup.location.city]))
  const start = meetup.startsAt.replace(/[-:]/g, '').replace('.000', '')
  const end = meetup.endsAt.replace(/[-:]/g, '').replace('.000', '')

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(meetup.startsAt)}&enddt=${encodeURIComponent(meetup.endsAt)}&body=${details}&location=${location}`,
  }
}

function buildIcs(meetup: Meetup): string {
  const escape = (value: string): string => value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n')

  const toUtcStamp = (value: string): string =>
    new Date(value).toISOString().replace(/[-:]/g, '').replace('.000', '')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//coders.mu//CLI//EN',
    'BEGIN:VEVENT',
    `UID:${meetup.id}@coders.mu`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${toUtcStamp(meetup.startsAt)}`,
    `DTEND:${toUtcStamp(meetup.endsAt)}`,
    `SUMMARY:${escape(meetup.title)}`,
    `DESCRIPTION:${escape(meetup.links.meetup ? `${meetup.summary}\n\nMore details: ${meetup.links.meetup}` : meetup.summary)}`,
    `LOCATION:${escape(joinParts([meetup.location.name, meetup.location.address, meetup.location.city]))}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

function renderSession(session: MeetupSession): string {
  const speakers = session.speakers.map((speaker) => speaker.name).join(', ')
  return speakers ? `- ${session.title} (${speakers})` : `- ${session.title}`
}

function renderSpeaker(speaker: MeetupSpeaker): string {
  return `- ${speaker.name}${speaker.githubUsername ? ` (@${speaker.githubUsername})` : ''}`
}

function renderMeetupDetail(meetup: Meetup): void {
  const calendar = buildCalendarUrls(meetup)
  const infoLines = [
    colorize('cyan', meetup.slug),
    `${colorize('yellow', 'When')}  ${formatMeetupRange(meetup)}`,
    `${colorize('yellow', 'Where')} ${joinParts([meetup.location.name, meetup.location.address, meetup.location.city]) || 'TBA'}`,
  ]

  if (typeof meetup.seatsAvailable === 'number') {
    infoLines.push(`${colorize('yellow', 'Seats')} ${meetup.seatsAvailable} available`)
  }
  else if (typeof meetup.rsvpCount === 'number' && meetup.rsvpCount > 0) {
    infoLines.push(`${colorize('yellow', 'RSVPs')} ${meetup.rsvpCount}`)
  }

  printBlock(meetup.title, infoLines)
  printBlock('Summary', wrapText(meetup.summary))

  if (meetup.sessions.length) {
    printBlock('Sessions', meetup.sessions.map(renderSession))
  }
  else if (meetup.speakers.length) {
    printBlock('Speakers', meetup.speakers.map(renderSpeaker))
  }

  if (meetup.sponsors.length) {
    printBlock('Sponsors', meetup.sponsors.map((sponsor) => `- ${sponsor.name}${sponsor.website ? ` (${sponsor.website})` : ''}`))
  }

  printBlock('Links', [
    meetup.links.meetup ? `Meetup page: ${meetup.links.meetup}` : 'Meetup page: n/a',
    meetup.links.rsvp ? `RSVP:        ${meetup.links.rsvp}` : meetup.acceptingRsvp ? 'RSVP:        Open on the website' : 'RSVP:        n/a',
    meetup.links.map ? `Map:         ${meetup.links.map}` : 'Map:         n/a',
    meetup.links.parking ? `Parking:     ${meetup.links.parking}` : 'Parking:     n/a',
  ])

  printBlock('Add To Calendar', [
    `Google:  ${calendar.google}`,
    `Outlook: ${calendar.outlook}`,
    'ICS:     run `codersmu calendar <slug> --write ./event.ics`',
  ])
}

function renderHelp(): void {
  console.log(`codersmu <command> [options]

Commands:
  codersmu next              Show the current or next meetup in detail
  codersmu current           Alias for \`codersmu next\`
  codersmu previous          Show the most recent past meetup in detail
  codersmu list [options]    List meetups
  codersmu view <slug|next|previous>  Show one meetup in detail
  codersmu calendar <slug|next|current|previous> [--write <path>]
                             Print calendar links or write an ICS file
  codersmu help              Show this help

Convenience:
  codersmu past              Alias for \`codersmu list --state past\`

Options:
  --json                     Print machine-readable JSON
  --short, -s                Use compact output where supported
  --write <path>             Write ICS output to a file
  --state <value>            Meetup list filter: upcoming, past, or all
  --limit <number>           Maximum number of meetups to print for list
`)
}

function renderJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2))
}

function parseMeetupListState(value?: string): MeetupListState {
  if (!value) {
    return 'upcoming'
  }

  if (value === 'upcoming' || value === 'past' || value === 'all') {
    return value
  }

  throw new Error(`Invalid --state value: ${value}. Use upcoming, past, or all.`)
}

function parseLimit(value?: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid --limit value: ${value}. Use a positive integer.`)
  }

  return parsed
}

async function resolveProvider(): Promise<MeetupProvider> {
  const cached = await readMeetupCache()
  const shouldForceRefresh = process.env.CODERSMU_FORCE_REFRESH === '1'

  if (cached && !shouldForceRefresh && isMeetupCacheFresh(cached)) {
    return new CacheMeetupProvider(cached)
  }

  try {
    const cache = await scrapeCodersMuMeetups()
    await writeMeetupCache(cache)
    return new CacheMeetupProvider(cache)
  }
  catch (error) {
    if (cached) {
      return new CacheMeetupProvider(cached)
    }

    throw error
  }
}

async function refreshCache(): Promise<{ cache: MeetupCache, cacheFile: string }> {
  const cache = await scrapeCodersMuMeetups()
  const cacheFile = await writeMeetupCache(cache)
  return { cache, cacheFile }
}

function sortMeetupsAscending(meetups: Meetup[]): Meetup[] {
  return [...meetups].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
}

async function getMeetupsForList(provider: MeetupProvider, state: MeetupListState): Promise<Meetup[]> {
  if (state === 'past') {
    return getPastMeetups(provider)
  }

  if (state === 'all') {
    return getSortedMeetups(provider)
  }

  const now = Date.now()
  return sortMeetupsAscending(await provider.listMeetups())
    .filter((meetup) => Date.parse(meetup.endsAt) >= now)
}

async function handleCacheRefresh(options: CliOptions): Promise<void> {
  const { cache, cacheFile } = await refreshCache()
  const nextMeetup = [...cache.meetups]
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
    .find((meetup) => Date.parse(meetup.endsAt) >= Date.now())

  const payload = {
    scrapedAt: cache.scrapedAt,
    source: cache.source,
    cacheFile,
    meetupCount: cache.meetups.length,
    nextMeetup: nextMeetup ? {
      title: nextMeetup.title,
      slug: nextMeetup.slug,
      startsAt: nextMeetup.startsAt,
    } : null,
  }

  if (options.json) {
    renderJson(payload)
    return
  }

  printBlock('Cache Refreshed', [
    `Source:     ${cache.source}`,
    `Scraped at: ${cache.scrapedAt}`,
    `Meetups:    ${cache.meetups.length}`,
    `Cache:      ${cacheFile}`,
    nextMeetup ? `Next:       ${nextMeetup.title} (${nextMeetup.slug})` : 'Next:       none',
  ])
}

async function handleMeetupList(options: CliOptions): Promise<void> {
  const provider = await resolveProvider()
  const state = parseMeetupListState(options.state)
  const limit = parseLimit(options.limit)
  const meetups = await getMeetupsForList(provider, state)
  const limitedMeetups = typeof limit === 'number' ? meetups.slice(0, limit) : meetups

  if (options.json) {
    renderJson(limitedMeetups)
    return
  }

  if (!limitedMeetups.length) {
    console.log('No meetups found.')
    return
  }

  const title = state === 'past'
    ? 'Past Meetups'
    : state === 'all'
      ? 'All Meetups'
      : 'Upcoming Meetups'

  console.log(colorize('bold', title))
  console.log()
  for (const meetup of limitedMeetups) {
    if (options.short) {
      renderMeetupShortLine(meetup)
      continue
    }
    renderMeetupCard(meetup)
  }

  if (options.short) {
    console.log()
  }
}

async function handleMeetupView(selector: string, options: CliOptions): Promise<void> {
  const provider = await resolveProvider()
  const meetup = await getMeetup(provider, selector)
  if (!meetup) {
    console.error(`Meetup not found: ${selector}`)
    process.exitCode = 1
    return
  }

  if (options.json) {
    renderJson(meetup)
    return
  }

  if (options.short) {
    renderMeetupCard(meetup)
    return
  }

  renderMeetupDetail(meetup)
}

async function handleMeetupCalendar(selector: string, options: CliOptions): Promise<void> {
  const provider = await resolveProvider()
  const meetup = await getMeetup(provider, selector)
  if (!meetup) {
    console.error(`Meetup not found: ${selector}`)
    process.exitCode = 1
    return
  }

  const payload = {
    meetup: meetup.slug,
    ...buildCalendarUrls(meetup),
  }

  if (options.write) {
    await writeFile(options.write, buildIcs(meetup), 'utf8')
    console.log(`ICS file written to ${options.write}`)
    return
  }

  if (options.json) {
    renderJson(payload)
    return
  }

  printBlock(`Calendar Links for ${meetup.title}`, [
    `Google:  ${payload.google}`,
    `Outlook: ${payload.outlook}`,
    'ICS:     use `--write ./event.ics` to generate a file',
  ])
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: {
        json: {
          type: 'boolean',
        },
        short: {
          type: 'boolean',
          short: 's',
        },
        write: {
          type: 'string',
        },
        state: {
          type: 'string',
        },
        limit: {
          type: 'string',
        },
      },
    })

    const options: CliOptions = {
      json: parsed.values.json ?? false,
      short: parsed.values.short ?? false,
      write: parsed.values.write,
      state: parsed.values.state,
      limit: parsed.values.limit,
    }

    const [command = 'help', ...args] = parsed.positionals

    switch (command) {
      case 'help': {
        renderHelp()
        return
      }
      case 'list': {
        await handleMeetupList(options)
        return
      }
      case 'view': {
        await handleMeetupView(args[0] ?? 'next', options)
        return
      }
      case 'scrape': {
        await handleCacheRefresh(options)
        return
      }
      case '__refresh-cache': {
        await handleCacheRefresh(options)
        return
      }
      case 'cache': {
        const [subcommand = 'help'] = args
        if (subcommand === 'refresh') {
          await handleCacheRefresh(options)
          return
        }
        console.error(`Unknown cache command: ${subcommand}`)
        process.exitCode = 1
        return
      }
      case 'next': {
        await handleMeetupView('next', options)
        return
      }
      case 'current': {
        await handleMeetupView('current', options)
        return
      }
      case 'previous': {
        await handleMeetupView('previous', options)
        return
      }
      case 'past': {
        await handleMeetupList({
          ...options,
          state: 'past',
        })
        return
      }
      case 'calendar': {
        await handleMeetupCalendar(args[0] ?? 'next', options)
        return
      }
      case 'meetup': {
        const [subcommand = 'help', target] = args
        if (subcommand === 'list') {
          await handleMeetupList(options)
          return
        }
        if (subcommand === 'view') {
          await handleMeetupView(target ?? 'next', options)
          return
        }
        if (subcommand === 'calendar') {
          await handleMeetupCalendar(target ?? 'next', options)
          return
        }
        if (subcommand === 'help') {
          renderHelp()
          return
        }

        // Backward-compatible alias: `codersmu meetup <slug>`
        await handleMeetupView(subcommand, options)
        return
      }
      default: {
        console.error(`Unknown command: ${command}`)
        console.log()
        renderHelp()
        process.exitCode = 1
      }
    }
  }
  catch (error) {
    if (
      typeof error === 'object'
      && error
      && 'code' in error
      && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
    ) {
      const message = error instanceof Error ? error.message : String(error)
      const optionMatch = message.match(/Unknown option '([^']+)'/)
      const option = optionMatch?.[1]
      console.error(option ? `Unknown option: ${option}` : 'Unknown option.')
      console.error('Run `codersmu help` for usage.')
      process.exitCode = 1
      return
    }

    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

void main()
