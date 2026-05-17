/**
 * Cloudflare Worker Wrapper for Price Updater Service
 *
 * This is the platform-specific entry point that:
 * 1. Reads configuration from Cloudflare environment bindings
 * 2. Calls the platform-agnostic price update service
 * 3. Returns the generated transaction manifest for scheduled or HTTP triggers
 */
import type { LogLevel } from '@local-packages/common-utils/log-level'
import type { NetworkName, PriceUpdateError, PriceUpdateRunnerConfig } from '@local-service/price-updater/execution'
import type { ILogger } from '@local-service/price-updater/plugins'
import { isLogLevel, levelToNumber } from '@local-packages/common-utils/log-level'
import { configureWalletLogger } from '@local-packages/typescript-wallet/transactions'
import { runPriceUpdate, toPriceUpdateError } from '@local-service/price-updater/execution'
import { createSignedPriceUpdate } from '@local-service/price-updater/producer'
import { err, Result as NeverthrowResult, ok } from 'neverthrow'

interface Env {
  MNEMONIC: string
  DERIVATION_INDEX?: string
  DRY_RUN?: string

  NETWORK_NAME: string
  BADGE_RESOURCE_ADDRESS: string
  ORACLE_COMPONENT_ADDRESS: string
  BADGE_NFT_ID?: string

  PYTH_HERMES_URL: string
  COINGECKO_BASE_URL: string
  CAVIARNINE_BASE_URL: string
  ASTROLESCENT_BASE_URL: string
  PRICE_FETCH_TIMEOUT_MS: string
  TRANSACTION_FEE_XRD?: string
  PRICE_PAYLOAD_TTL_SEC?: string

  PYTH_MAX_AGE_SEC?: string

  DISABLE_PYTH?: string
  DISABLE_COINGECKO?: string
  DISABLE_CAVIARNINE?: string
  DISABLE_ASTROLESCENT?: string

  /** Minimum log level emitted. One of: debug | info | warn | error. Defaults to 'info'. */
  LOG_LEVEL?: string
}

interface ScheduledController {
  scheduledTime: number
  cron: string
}

interface ExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void
}

type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error'

// PARSE ENV

function requireBinding(env: Env, key: keyof Env): NeverthrowResult<string, PriceUpdateError> {
  const value = env[key]
  if (value === undefined || value === null || String(value).trim() === '')
    return err(toPriceUpdateError('readConfig', new Error(`Missing required Cloudflare binding: ${key}`)))

  return ok(String(value))
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '')
    return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function isDisabledFlag(value: string | undefined): boolean {
  return isTrueFlag(value)
}

function isTrueFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

function getRequiredConfig(env: Env) {
  return NeverthrowResult.combine([
    requireBinding(env, 'BADGE_RESOURCE_ADDRESS'),
    requireBinding(env, 'ORACLE_COMPONENT_ADDRESS'),
    requireBinding(env, 'NETWORK_NAME'),
    requireBinding(env, 'MNEMONIC'),
  ]).map(([
    badgeResourceAddress,
    oracleComponentAddress,
    networkName,
    mnemonic,
  ]) => ({
    badgeResourceAddress,
    oracleComponentAddress,
    badgeId: env.BADGE_NFT_ID ?? '#1#',
    networkName: networkName as NetworkName,
    mnemonic,
    derivationIndex: optionalNumber(env.DERIVATION_INDEX) ?? 0,
    dryRun: isTrueFlag(env.DRY_RUN),
    // URL defaults live in wrangler.toml [vars]; these are fallbacks for local .dev.vars omissions only.
    pythBaseUrl: env.PYTH_HERMES_URL,
    coingeckoBaseUrl: env.COINGECKO_BASE_URL,
    caviarnineBaseUrl: env.CAVIARNINE_BASE_URL,
    astrolescentBaseUrl: env.ASTROLESCENT_BASE_URL,
    timeoutMs: Number(env.PRICE_FETCH_TIMEOUT_MS),
    transactionFeeXrd: optionalNumber(env.TRANSACTION_FEE_XRD) ?? 5,
    signedPayloadTtlSec: optionalNumber(env.PRICE_PAYLOAD_TTL_SEC) ?? 60,
    maxPriceAgeSec: optionalNumber(env.PYTH_MAX_AGE_SEC),

    disablePyth: isDisabledFlag(env.DISABLE_PYTH),
    disableCaviarNine: isDisabledFlag(env.DISABLE_CAVIARNINE),
    disableCoinGecko: isDisabledFlag(env.DISABLE_COINGECKO),
    disableAstrolescent: isDisabledFlag(env.DISABLE_ASTROLESCENT),
    logLevel: env.LOG_LEVEL ?? 'info',
  } as PriceUpdateRunnerConfig))
}

// Manage logger

function parseLogLevel(raw: string | undefined): LogLevel {
  const level = raw?.toLowerCase()
  return level && isLogLevel(level) ? level : 'info'
}

function errorLogPayload(event: string, error: PriceUpdateError) {
  return {
    event,
    step: error.step,
    err: error.message,
    stack: error.stack,
  }
}
function createWorkerLogger(
  service: string,
  bindings: Record<string, unknown> = {},
  minLevel: LogLevel = 'info',
): ILogger {
  const minRank = levelToNumber(minLevel)

  const write = (level: WorkerLogLevel, message: unknown, args: unknown[]) => {
    if (levelToNumber(level) < minRank)
      return

    const payload = {
      service,
      level,
      ...bindings,
      ...(typeof message === 'object' && message !== null ? message : { message }),
      args: args.length > 0 ? args : undefined,
    }

    // eslint-disable-next-line no-console
    console[level](JSON.stringify(payload))
  }

  return {
    debug: (message, ...args) => write('debug', message, args),
    info: (message, ...args) => write('info', message, args),
    warn: (message, ...args) => write('warn', message, args),
    error: (message, ...args) => write('error', message, args),
    child: childBindings => createWorkerLogger(service, { ...bindings, ...childBindings }, minLevel),
  }
}

function createLocalLogger(
  bindings: Record<string, unknown> = {},
  minLevel: LogLevel = 'info',
): ILogger {
  const logger = createWorkerLogger('price-updater-worker', bindings, minLevel)
  configureWalletLogger(logger)
  return logger
}

// Json response helper

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')

  return new Response(JSON.stringify(body, bigIntReplacer), {
    ...init,
    headers,
  })
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

// Worker Logic

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname

    if (request.method === 'GET' && path === '/health') {
      return jsonResponse({ ok: true })
    }

    if (path === '/price-update-payload') {
      if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed' }, {
          status: 405,
          headers: { allow: 'GET' },
        })
      }

      const logger = createLocalLogger({ trigger: 'http', route: path }, parseLogLevel(env.LOG_LEVEL))

      return getRequiredConfig(env)
        .asyncAndThen(config => createSignedPriceUpdate(config, logger))
        .match(
          result => jsonResponse(result),
          (error) => {
            logger.error(errorLogPayload('oracle.price_payload.failed', error))
            return jsonResponse({ error: error.message, step: error.step }, { status: 500 })
          },
        )
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, {
        status: 405,
        headers: { allow: 'POST' },
      })
    }

    const logger = createLocalLogger({ trigger: 'http' }, parseLogLevel(env.LOG_LEVEL))

    return getRequiredConfig(env)
      .asyncAndThen(config => runPriceUpdate(config, logger))
      .match(
        result => jsonResponse(result),
        (error) => {
          logger.error(errorLogPayload('oracle.failed', error))
          return jsonResponse({ error: error.message, step: error.step }, { status: 500 })
        },
      )
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const logger = createLocalLogger({
      trigger: 'scheduled',
      cron: controller.cron,
      scheduledTime: controller.scheduledTime,
    }, parseLogLevel(env.LOG_LEVEL))

    ctx.waitUntil(
      getRequiredConfig(env)
        .asyncAndThen(config => runPriceUpdate(config, logger))
        .match(
          () => undefined,
          error => logger.error(errorLogPayload('oracle.failed', error)),
        ),
    )
  },
}

export default worker
