import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import pino, { stdSerializers } from 'pino'
import { Logger as TSLogger } from 'tslog'

export interface ILogger {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
  fatal?: (message: any, ...args: any[]) => void
  child: (bindings: Record<string, any>) => ILogger
}

export interface LoggerOptions {
  service: string
  level?: string
}

export function createLogger(options: LoggerOptions): ILogger {
  const isProduction = process.env.NODE_ENV === 'production'
  const level = options.level || process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug')

  if (isProduction) {
    const pinoLogger = pino({
      level,
      base: {
        service: options.service,
        env: process.env.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      serializers: {
        err: stdSerializers.err,
        error: stdSerializers.err,
      },
      redact: {
        paths: [
          '*.secret',
          '*.password',
          '*.key',
          '*.phrase',
          '*.apiKey',
          '*.token',
          'secret',
          'password',
          'key',
          'phrase',
          'apiKey',
          'token',
        ],
        censor: '***',
      },
    })

    const wrapPino = (p: pino.Logger): ILogger => ({
      debug: (msg, ...args) => p.debug(msg, ...args),
      info: (msg, ...args) => p.info(msg, ...args),
      warn: (msg, ...args) => p.warn(msg, ...args),
      error: (msg, ...args) => p.error(msg, ...args),
      fatal: (msg, ...args) => p.fatal(msg, ...args),
      child: bindings => wrapPino(p.child(bindings)),
    })

    return wrapPino(pinoLogger)
  }
  else {
    const tsLogger = new TSLogger({
      name: options.service,
      minLevel: levelToNumber(level),
      prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{name}}]\t',
    })

    const wrapTS = (t: TSLogger<any>): ILogger => ({
      debug: (msg, ...args) => t.debug(msg, ...args),
      info: (msg, ...args) => t.info(msg, ...args),
      warn: (msg, ...args) => t.warn(msg, ...args),
      error: (msg, ...args) => t.error(msg, ...args),
      fatal: (msg, ...args) => t.fatal(msg, ...args),
      child: bindings => wrapTS(t.getSubLogger({ name: `${t.settings.name}:${JSON.stringify(bindings)}` })),
    })

    return wrapTS(tsLogger)
  }
}

function levelToNumber(level: string): number {
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

// Default logger for simple use cases
export const logger = createLogger({ service: 'default' })

let ssmClient: SSMClient | undefined

export async function getSSMParameter(name: string, options: { decrypt?: boolean, region?: string } = {}): Promise<string> {
  if (!ssmClient) {
    ssmClient = new SSMClient({ region: options.region || process.env.AWS_REGION || 'us-east-1' })
  }

  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: name,
      WithDecryption: options.decrypt ?? true,
    }))

    if (!response.Parameter?.Value) {
      throw new Error(`SSM Parameter ${name} found but has no value`)
    }

    return response.Parameter.Value
  }
  catch (error) {
    logger.error({ event: 'ssm.parameter.fetch_failed', name, err: error })
    throw error
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : undefined
}

/**
 * Factory interface for retrieving environment variables and secrets.
 * Wrappers implement this to provide cached SSM parameters or env vars.
 * This allows services to read configuration without platform coupling.
 */
export interface EnvFactory {
  /**
   * Get a required environment variable or secret.
   * @param key - The variable name
   * @throws Error if the variable is not set
   */
  require: (key: string) => string

  /**
   * Get an optional environment variable or secret.
   * @param key - The variable name
   * @returns The value or undefined if not set
   */
  optional: (key: string) => string | undefined
}

/**
 * Cache for SSM parameters - persists across Lambda warm invocations.
 */
const ssmParamCache = new Map<string, string>()

/**
 * Create an EnvFactory with support for cached SSM parameters.
 *
 * @param ssmMappings - Map of env var names to SSM parameter paths
 *   e.g., { SEED_PHRASE: '/prod/liquidator/seed-phrase' }
 * @returns EnvFactory that checks cache, then env vars
 *
 * @example
 * ```ts
 * // Pre-fetch and cache SSM params, then create factory
 * const env = await createEnvFactory({
 *   SEED_PHRASE: process.env.SEED_PHRASE_PARAM,
 * })
 * const secret = env.require('SEED_PHRASE')
 * ```
 */
export async function createEnvFactory(
  ssmMappings: Record<string, string | undefined> = {},
): Promise<EnvFactory> {
  // Fetch and cache any SSM parameters that haven't been cached yet
  for (const [envKey, ssmPath] of Object.entries(ssmMappings)) {
    if (ssmPath && !ssmParamCache.has(envKey)) {
      try {
        const value = await getSSMParameter(ssmPath)
        ssmParamCache.set(envKey, value)
        logger.debug({ event: 'env.ssm.cached', key: envKey, path: ssmPath })
      }
      catch (error) {
        logger.error({ event: 'env.ssm.fetch_failed', key: envKey, path: ssmPath, err: error })
      }
    }
  }

  return {
    require: (key: string): string => {
      // First check SSM cache
      const cached = ssmParamCache.get(key)
      if (cached)
        return cached

      // Then check env vars
      const value = process.env[key]
      if (!value) {
        throw new Error(`Missing required env var or secret: ${key}`)
      }
      return value
    },

    optional: (key: string): string | undefined => {
      // First check SSM cache
      const cached = ssmParamCache.get(key)
      if (cached)
        return cached

      // Then check env vars
      const value = process.env[key]
      return value && value.trim().length > 0 ? value : undefined
    },
  }
}

/**
 * Create a simple EnvFactory from process.env (no SSM caching).
 * Useful for local development or when SSM is not needed.
 */
export function createSimpleEnvFactory(): EnvFactory {
  return {
    require: requireEnv,
    optional: optionalEnv,
  }
}
