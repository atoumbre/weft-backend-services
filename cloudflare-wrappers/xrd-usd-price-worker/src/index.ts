/**
 * Cloudflare Worker that serves a cached XRD/USD quote.
 *
 * CoinGecko is the primary source; KuCoin then Gate.io XRD-USDT are fallbacks.
 * Quotes are stored in KV for CACHE_TTL_SEC (default 5 minutes).
 */
import type { ILogger, LogLevel } from '@local-packages/common-utils/logger'
import type { XrdUsdPrice } from '@local-service/price-updater/xrd-usd'
import { fetchXrdUsdPrice } from '@local-service/price-updater/xrd-usd'

interface KVNamespace {
  get: <T = unknown>(key: string, type: 'json') => Promise<T | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

interface Env {
  COINGECKO_BASE_URL: string
  KUCOIN_BASE_URL: string
  GATEIO_BASE_URL: string
  PRICE_FETCH_TIMEOUT_MS: string
  CACHE_TTL_SEC?: string
  LOG_LEVEL?: string
  DISABLE_COINGECKO?: string
  DISABLE_KUCOIN?: string
  DISABLE_GATEIO?: string
  COINGECKO_API_KEY?: string
  XRD_USD_CACHE: KVNamespace
}

interface CachedXrdUsdPrice extends XrdUsdPrice {
  expiresAtUnixMs: number
}

type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error'

const CACHE_KEY = 'xrd-usd'
const DEFAULT_CACHE_TTL_SECONDS = 300
const KV_MIN_EXPIRATION_TTL_SECONDS = 60
const LOG_LEVELS = ['silly', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

function isLogLevel(level: string): level is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(level)
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

function isTrueFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '')
    return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

function cacheTtlSeconds(env: Env): number {
  return Math.max(
    KV_MIN_EXPIRATION_TTL_SECONDS,
    optionalNumber(env.CACHE_TTL_SEC) ?? DEFAULT_CACHE_TTL_SECONDS,
  )
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const level = raw?.toLowerCase()
  return level && isLogLevel(level) ? level : 'info'
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

function corsHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  return headers
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = corsHeaders(init.headers)
  headers.set('content-type', 'application/json')

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readConfig(env: Env) {
  const coingeckoBaseUrl = env.COINGECKO_BASE_URL?.trim()
  const kucoinBaseUrl = env.KUCOIN_BASE_URL?.trim()
  const gateioBaseUrl = env.GATEIO_BASE_URL?.trim()
  const timeoutMs = Number(env.PRICE_FETCH_TIMEOUT_MS)

  if (!coingeckoBaseUrl || !kucoinBaseUrl || !gateioBaseUrl || !Number.isFinite(timeoutMs)) {
    throw Object.assign(new Error('Missing required Cloudflare bindings for XRD/USD price'), {
      step: 'readConfig',
    })
  }

  return {
    coingeckoBaseUrl,
    coingeckoApiKey: env.COINGECKO_API_KEY?.trim() || undefined,
    kucoinBaseUrl,
    gateioBaseUrl,
    timeoutMs,
    disableCoinGecko: isTrueFlag(env.DISABLE_COINGECKO),
    disableKucoin: isTrueFlag(env.DISABLE_KUCOIN),
    disableGateio: isTrueFlag(env.DISABLE_GATEIO),
  }
}

function isUsableCachedPrice(cached: CachedXrdUsdPrice | null, now: number): cached is CachedXrdUsdPrice {
  return cached !== null && cached.expiresAtUnixMs > now
}

async function getCachedXrdUsdPrice(
  env: Env,
  logger: ILogger,
): Promise<CachedXrdUsdPrice> {
  const now = Date.now()
  const ttlSeconds = cacheTtlSeconds(env)

  let cached: CachedXrdUsdPrice | null = null
  try {
    cached = await env.XRD_USD_CACHE.get<CachedXrdUsdPrice>(CACHE_KEY, 'json')
  }
  catch (error) {
    logger.warn({ event: 'xrd_usd.cache.read_failed', err: errorMessage(error) })
  }

  if (isUsableCachedPrice(cached, now)) {
    logger.info({
      event: 'xrd_usd.cache.hit',
      cache: 'kv',
      expiresInMs: cached.expiresAtUnixMs - now,
    })
    return cached
  }

  logger.info({ event: 'xrd_usd.cache.miss', cache: 'kv' })

  const fresh = await fetchXrdUsdPrice(readConfig(env), logger)
  const payload: CachedXrdUsdPrice = {
    ...fresh,
    expiresAtUnixMs: Date.now() + ttlSeconds * 1000,
  }

  try {
    await env.XRD_USD_CACHE.put(CACHE_KEY, JSON.stringify(payload), {
      expirationTtl: ttlSeconds,
    })
    logger.info({
      event: 'xrd_usd.cache.write',
      cache: 'kv',
      ttlMs: payload.expiresAtUnixMs - Date.now(),
    })
  }
  catch (error) {
    logger.warn({ event: 'xrd_usd.cache.write_failed', err: errorMessage(error) })
  }

  return payload
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      })
    }

    const path = new URL(request.url).pathname
    const logger = createWorkerLogger(
      'xrd-usd-price-worker',
      { trigger: 'http', route: path },
      parseLogLevel(env.LOG_LEVEL),
    )

    if (path === '/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return jsonResponse({ error: 'Method not allowed' }, {
          status: 405,
          headers: { 'allow': 'GET, HEAD, OPTIONS', 'Cache-Control': 'no-store' },
        })
      }

      return jsonResponse({ ok: true }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    if (path === '/xrd-usd') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return jsonResponse({ error: 'Method not allowed' }, {
          status: 405,
          headers: { 'allow': 'GET, HEAD, OPTIONS', 'Cache-Control': 'no-store' },
        })
      }

      try {
        const result = await getCachedXrdUsdPrice(env, logger)
        const remainingSec = Math.max(0, Math.floor((result.expiresAtUnixMs - Date.now()) / 1000))

        return jsonResponse(result, {
          headers: { 'Cache-Control': `public, max-age=${remainingSec}` },
        })
      }
      catch (error) {
        const step = typeof error === 'object' && error !== null && 'step' in error && typeof error.step === 'string'
          ? error.step
          : 'fetchXrdUsdPrice'
        logger.error({ event: 'xrd_usd.failed', step, err: errorMessage(error) })
        return jsonResponse({ error: errorMessage(error), step }, {
          status: 500,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    }

    return jsonResponse({ error: 'Not found' }, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  },
}

export default worker
