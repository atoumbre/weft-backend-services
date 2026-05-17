export const LOG_LEVELS = [
  'silly',
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const

export type LogLevel = typeof LOG_LEVELS[number]

const LOG_LEVEL_SET = new Set<string>(LOG_LEVELS)

export function isLogLevel(level: string): level is LogLevel {
  return LOG_LEVEL_SET.has(level)
}

export function levelToNumber(level: string): number {
  switch (level.toLowerCase()) {
    case 'silly': return 0
    case 'trace': return 1
    case 'debug': return 2
    case 'info': return 3
    case 'warn': return 4
    case 'error': return 5
    case 'fatal': return 6
    default: return 3
  }
}
