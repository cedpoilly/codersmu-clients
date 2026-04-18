import process from 'node:process'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
}

interface LogFields {
  [key: string]: unknown
}

function normalizeLogLevel(value: string | undefined): LogLevel {
  switch (value?.trim().toLowerCase()) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
    case 'silent':
      return value.trim().toLowerCase() as LogLevel
    default:
      return process.env.NODE_ENV === 'test' ? 'silent' : 'info'
  }
}

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = normalizeLogLevel(process.env.CODERSMU_API_LOG_LEVEL)
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel]
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue)]),
    )
  }

  return value
}

export function logEvent(level: LogLevel, event: string, fields: LogFields = {}): void {
  if (!shouldLog(level)) {
    return
  }

  const serializedFields = serializeValue(fields) as LogFields
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...serializedFields,
  }

  const line = JSON.stringify(entry)

  if (level === 'warn' || level === 'error') {
    console.error(line)
    return
  }

  console.log(line)
}
