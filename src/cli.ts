#!/usr/bin/env node

import { writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import process from 'node:process'
import { parseArgs } from 'node:util'

import {
  buildCalendarUrls,
  buildIcs,
  getMeetup,
  getMeetupEndsAt,
  getMeetupLifecycleStatus,
  getMeetupLinks,
  getMeetupLocationParts,
  getMeetupSlug,
  getMeetupSpeakerNames,
  getMeetupStartsAt,
  getMeetupSummary,
  getMeetupTimezone,
  getMeetupsForList,
  isPastMeetup,
  refreshDefaultMeetupCache,
  resolveDefaultMeetupProvider,
  sortMeetupsAscending,
} from '@codersmu/core'
import type { Meetup, MeetupListState, MeetupProvider, MeetupSession, MeetupSpeaker } from '@codersmu/core'

const require = createRequire(import.meta.url)
const { version: CLI_VERSION } = require('../package.json') as { version: string }
const DEFAULT_CLI_HOSTED_API_BASE_URL = 'https://codersmu.cedpoilly.dev'

interface CliOptions {
  json: boolean
  short: boolean
  refresh: boolean
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
const DEFAULT_USE_COLOR = Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env)
let useColor = DEFAULT_USE_COLOR

function configureCliHostedApi(): void {
  process.env.CODERSMU_HOSTED_API_BASE_URL ||= DEFAULT_CLI_HOSTED_API_BASE_URL
}

configureCliHostedApi()

function colorize(color: keyof typeof COLORS, value: string): string {
  if (!useColor) {
    return value
  }

  return `${COLORS[color]}${value}${COLORS.reset}`
}

async function resolveMeetupProvider(options: CliOptions): Promise<MeetupProvider> {
  return resolveDefaultMeetupProvider({
    forceRefresh: options.refresh,
    allowStaleOnError: !options.refresh,
  })
}

function renderVersion(): void {
  console.log(`codersmu ${CLI_VERSION}`)
}

function getMeetupNotFoundMessage(selector: string): string {
  if (selector === 'next' || selector === 'current') {
    return 'No upcoming meetup found.'
  }

  if (selector === 'previous' || selector === 'prev' || selector === 'last') {
    return 'No previous meetup found.'
  }

  return `Meetup not found: ${selector}`
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
  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)
  const timezone = getMeetupTimezone(meetup)

  if (!startsAt || !endsAt) {
    return 'Date TBA'
  }

  const endDate = new Date(endsAt)
  const startDate = new Date(startsAt)
  const sameLocalDay = new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: timezone,
  }).format(startDate) === new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'short',
    timeZone: timezone,
  }).format(endDate)

  const endLabel = sameLocalDay
    ? new Intl.DateTimeFormat('en-MU', {
        timeStyle: 'short',
        timeZone: timezone,
      }).format(endDate)
    : formatMeetupDate(endsAt, timezone)

  return `${formatMeetupDate(startsAt, timezone)} to ${endLabel}`
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
  const location = getMeetupLocationParts(meetup)
  console.log(colorize('bold', meetup.title))
  console.log(colorize('cyan', getMeetupSlug(meetup)))
  console.log(formatMeetupRange(meetup))
  console.log(joinParts([location.name, location.address, location.city]) || 'Location TBA')
  console.log(colorize('dim', getMeetupSummary(meetup)))
  console.log()
}

function renderMeetupShortLine(meetup: Meetup): void {
  const startsAt = getMeetupStartsAt(meetup)
  const timezone = getMeetupTimezone(meetup)
  const location = getMeetupLocationParts(meetup)
  const locationLabel = joinParts([location.name, location.city]) || location.name || location.address || 'TBA'
  const dayLabel = startsAt ? formatMeetupDay(startsAt, timezone) : 'TBA'
  console.log(`${dayLabel}  ${meetup.title}  (${getMeetupSlug(meetup)})  ${locationLabel}`)
}

function renderSession(session: MeetupSession): string {
  const speakers = session.speakers.map((speaker) => speaker.name).join(', ')
  return speakers ? `- ${session.title} (${speakers})` : `- ${session.title}`
}

function renderSpeaker(speaker: MeetupSpeaker): string {
  return `- ${speaker.name}${speaker.githubUsername ? ` (@${speaker.githubUsername})` : ''}`
}

function renderMeetupDetail(meetup: Meetup): void {
  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)
  const calendar = startsAt && endsAt ? buildCalendarUrls(meetup) : null
  const location = getMeetupLocationParts(meetup)
  const links = getMeetupLinks(meetup)
  const speakerNames = getMeetupSpeakerNames(meetup)
  const infoLines = [
    colorize('cyan', getMeetupSlug(meetup)),
    `${colorize('yellow', 'When')}  ${formatMeetupRange(meetup)}`,
    `${colorize('yellow', 'Where')} ${joinParts([location.name, location.address, location.city]) || 'TBA'}`,
  ]

  if (typeof meetup.seatsRemaining === 'number') {
    infoLines.push(`${colorize('yellow', 'Seats')} ${meetup.seatsRemaining} remaining`)
  }
  else if (typeof meetup.capacityTotal === 'number') {
    infoLines.push(`${colorize('yellow', 'Capacity')} ${meetup.capacityTotal} total`)
  }
  else if (typeof meetup.seatsAvailable === 'number') {
    infoLines.push(`${colorize('yellow', 'Seats')} ${meetup.seatsAvailable} available`)
  }
  else if (typeof meetup.attendeeCount === 'number' && meetup.attendeeCount > 0) {
    infoLines.push(`${colorize('yellow', 'Attendees')} ${meetup.attendeeCount}`)
  }

  printBlock(meetup.title, infoLines)
  printBlock('Summary', wrapText(getMeetupSummary(meetup)))

  if (meetup.sessions.length) {
    printBlock('Sessions', meetup.sessions.map(renderSession))
  }
  else if (speakerNames.length) {
    printBlock('Speakers', speakerNames.map((speaker) => `- ${speaker}`))
  }

  if (meetup.sponsors.length) {
    printBlock('Sponsors', meetup.sponsors.map((sponsor) => `- ${sponsor.name}${sponsor.website ? ` (${sponsor.website})` : ''}`))
  }

  printBlock('Links', [
    `Meetup page: ${links.meetup}`,
    links.rsvp ? `RSVP:        ${links.rsvp}` : meetup.acceptingRsvp ? 'RSVP:        Open on the website' : 'RSVP:        n/a',
    'Recording:   n/a',
    'Slides:      n/a',
    links.map ? `Map:         ${links.map}` : 'Map:         n/a',
    links.parking ? `Parking:     ${links.parking}` : 'Parking:     n/a',
  ])

  printBlock('Add To Calendar', calendar ? [
    `Google:  ${calendar.google}`,
    `Outlook: ${calendar.outlook}`,
    'ICS:     run `codersmu calendar <slug> --write ./event.ics`',
  ] : [
    'Calendar links are unavailable until the meetup schedule is published.',
  ])
}

function renderHelp(): void {
  console.log(`codersmu <command> [options]

Commands:
  codersmu next              Show the current or next meetup in detail
  codersmu current           Alias for \`codersmu next\`
  codersmu previous          Show the most recent past meetup in detail
  codersmu list [options]    List meetups
  codersmu ls [options]      Alias for \`codersmu list\`
  codersmu view <slug|next|previous>  Show one meetup in detail
  codersmu show <slug|next|previous>  Alias for \`codersmu view\`
  codersmu calendar <slug|next|current|previous> [--write <path>]
                             Print calendar links or write an ICS file
  codersmu refresh           Refresh the local meetup cache
  codersmu cache refresh     Refresh the local meetup cache
  codersmu help              Show this help

Convenience:
  codersmu past              Alias for \`codersmu list --state past\`

Options:
  --help, -h                 Show this help
  --version, -v              Print the current CLI version
  --json                     Print machine-readable JSON
  --short, -s                Use compact output where supported
  --refresh                  Force a live refresh before reading meetup data
  --write <path>             Write ICS output to a file
  --state <value>            Meetup list filter: upcoming, past, or all
  --limit <number>           Maximum number of meetups to print for list
  --no-color                 Disable ANSI colors in terminal output
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

async function handleCacheRefresh(options: CliOptions): Promise<void> {
  const { cache, cacheFile } = await refreshDefaultMeetupCache()
  const nextMeetup = sortMeetupsAscending(cache.meetups)
    .find((meetup) => !isPastMeetup(meetup))

  const payload = {
    scrapedAt: cache.scrapedAt,
    source: cache.source,
    cacheFile,
    meetupCount: cache.meetups.length,
    nextMeetup: nextMeetup ? {
      title: nextMeetup.title,
      slug: getMeetupSlug(nextMeetup),
      startsAt: getMeetupStartsAt(nextMeetup),
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
    nextMeetup ? `Next:       ${nextMeetup.title} (${getMeetupSlug(nextMeetup)})` : 'Next:       none',
  ])
}

async function handleMeetupList(options: CliOptions): Promise<void> {
  const provider = await resolveMeetupProvider(options)
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
  const provider = await resolveMeetupProvider(options)
  const meetup = await getMeetup(provider, selector)
  if (!meetup) {
    console.error(getMeetupNotFoundMessage(selector))
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
  const provider = await resolveMeetupProvider(options)
  const meetup = await getMeetup(provider, selector)
  if (!meetup) {
    console.error(getMeetupNotFoundMessage(selector))
    process.exitCode = 1
    return
  }

  const startsAt = getMeetupStartsAt(meetup)
  const endsAt = getMeetupEndsAt(meetup)
  if (!startsAt || !endsAt) {
    const payload = {
      meetup: getMeetupSlug(meetup),
      available: false,
      reason: 'Calendar links are unavailable until the meetup schedule is published.',
    }

    if (options.json) {
      renderJson(payload)
    } else {
      console.error(payload.reason)
      process.exitCode = 1
    }
    return
  }

  const payload = {
    meetup: getMeetupSlug(meetup),
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
        help: {
          type: 'boolean',
          short: 'h',
        },
        version: {
          type: 'boolean',
          short: 'v',
        },
        json: {
          type: 'boolean',
        },
        short: {
          type: 'boolean',
          short: 's',
        },
        refresh: {
          type: 'boolean',
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
        'no-color': {
          type: 'boolean',
        },
      },
    })

    useColor = DEFAULT_USE_COLOR && !(parsed.values['no-color'] ?? false)

    if (parsed.values.help) {
      renderHelp()
      return
    }

    if (parsed.values.version) {
      renderVersion()
      return
    }

    const options: CliOptions = {
      json: parsed.values.json ?? false,
      short: parsed.values.short ?? false,
      refresh: parsed.values.refresh ?? false,
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
      case 'ls': {
        await handleMeetupList(options)
        return
      }
      case 'view': {
        await handleMeetupView(args[0] ?? 'next', options)
        return
      }
      case 'show': {
        await handleMeetupView(args[0] ?? 'next', options)
        return
      }
      case 'scrape': {
        await handleCacheRefresh(options)
        return
      }
      case 'refresh': {
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
