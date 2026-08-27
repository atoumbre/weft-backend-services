/// <reference types="bun-types" />

import type { XrdUsdPrice } from '@local-service/price-updater/xrd-usd'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

const samplePrice: XrdUsdPrice = {
  symbol: 'XRD',
  currency: 'USD',
  price: '0.00092',
  source: 'coingecko',
  publishTime: 1_729_172_965,
  fetchedAtUnixMs: 1_729_172_965_000,
}

const fetchXrdUsdPrice = mock(async (): Promise<XrdUsdPrice> => ({
  ...samplePrice,
  fetchedAtUnixMs: Date.now(),
}))

mock.module('@local-service/price-updater/xrd-usd', () => ({
  fetchXrdUsdPrice,
}))

const { default: worker } = await import('../src/index')

interface MemoryKv {
  store: Map<string, string>
  lastPutOptions: { expirationTtl?: number } | undefined
  get: <T = unknown>(key: string, type: 'json') => Promise<T | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
}

function createMemoryKv(options?: {
  throwOnGet?: boolean
  throwOnPut?: boolean
}): MemoryKv {
  const store = new Map<string, string>()
  let lastPutOptions: { expirationTtl?: number } | undefined

  return {
    store,
    get lastPutOptions() {
      return lastPutOptions
    },
    async get<T>(key: string, _type: 'json'): Promise<T | null> {
      if (options?.throwOnGet)
        throw new Error('kv get failed')
      const raw = store.get(key)
      return raw == null ? null : JSON.parse(raw) as T
    },
    async put(key: string, value: string, putOptions?: { expirationTtl?: number }) {
      if (options?.throwOnPut)
        throw new Error('kv put failed')
      lastPutOptions = putOptions
      store.set(key, value)
    },
  }
}

function createEnv(kv: MemoryKv, overrides: Record<string, string | undefined> = {}) {
  return {
    COINGECKO_BASE_URL: 'https://api.coingecko.com',
    KUCOIN_BASE_URL: 'https://api.kucoin.com',
    GATEIO_BASE_URL: 'https://api.gateio.ws',
    PRICE_FETCH_TIMEOUT_MS: '5000',
    CACHE_TTL_SEC: '300',
    LOG_LEVEL: 'error',
    XRD_USD_CACHE: kv,
    ...overrides,
  }
}

function request(path: string, method = 'GET') {
  return new Request(`https://example.com${path}`, { method })
}

describe('xrd-usd-price-worker', () => {
  beforeEach(() => {
    fetchXrdUsdPrice.mockClear()
    fetchXrdUsdPrice.mockImplementation(async () => ({
      ...samplePrice,
      fetchedAtUnixMs: Date.now(),
    }))
  })

  afterEach(() => {
    fetchXrdUsdPrice.mockClear()
  })

  it('GET /health returns ok with no-store and CORS', async () => {
    const response = await worker.fetch(request('/health'), createEnv(createMemoryKv()))
    const body = await response.json() as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    expect(fetchXrdUsdPrice).not.toHaveBeenCalled()
  })

  it('OPTIONS /xrd-usd returns 204 with CORS allow headers', async () => {
    const response = await worker.fetch(request('/xrd-usd', 'OPTIONS'), createEnv(createMemoryKv()))

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS')
    expect(fetchXrdUsdPrice).not.toHaveBeenCalled()
  })

  it('GET /unknown returns 404', async () => {
    const response = await worker.fetch(request('/unknown'), createEnv(createMemoryKv()))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(404)
    expect(body.error).toBe('Not found')
  })

  it('POST /xrd-usd returns 405', async () => {
    const response = await worker.fetch(request('/xrd-usd', 'POST'), createEnv(createMemoryKv()))
    const body = await response.json() as { error: string }

    expect(response.status).toBe(405)
    expect(body.error).toBe('Method not allowed')
    expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS')
    expect(fetchXrdUsdPrice).not.toHaveBeenCalled()
  })

  it('GET /xrd-usd cache miss fetches once and writes KV with TTL 300', async () => {
    const kv = createMemoryKv()
    const response = await worker.fetch(request('/xrd-usd'), createEnv(kv))
    const body = await response.json() as { price: string, expiresAtUnixMs: number }

    expect(response.status).toBe(200)
    expect(body.price).toBe('0.00092')
    expect(body.expiresAtUnixMs).toBeGreaterThan(Date.now())
    expect(fetchXrdUsdPrice).toHaveBeenCalledTimes(1)
    expect(fetchXrdUsdPrice.mock.calls[0]?.[0]).toMatchObject({
      gateioBaseUrl: 'https://api.gateio.ws',
      disableGateio: false,
    })
    expect(kv.lastPutOptions?.expirationTtl).toBe(300)
    expect(kv.store.has('xrd-usd')).toBe(true)
  })

  it('GET /xrd-usd cache hit does not refetch', async () => {
    const kv = createMemoryKv()
    const env = createEnv(kv)

    await worker.fetch(request('/xrd-usd'), env)
    fetchXrdUsdPrice.mockClear()

    const response = await worker.fetch(request('/xrd-usd'), env)
    const body = await response.json() as { price: string }

    expect(response.status).toBe(200)
    expect(body.price).toBe('0.00092')
    expect(fetchXrdUsdPrice).not.toHaveBeenCalled()
  })

  it('GET /xrd-usd refetches when the KV entry is expired', async () => {
    const kv = createMemoryKv()
    await kv.put('xrd-usd', JSON.stringify({
      ...samplePrice,
      expiresAtUnixMs: Date.now() - 1000,
    }))

    const response = await worker.fetch(request('/xrd-usd'), createEnv(kv))

    expect(response.status).toBe(200)
    expect(fetchXrdUsdPrice).toHaveBeenCalledTimes(1)
  })

  it('returns 500 without caching when fetchXrdUsdPrice throws', async () => {
    fetchXrdUsdPrice.mockImplementation(async () => {
      throw new Error('upstream down')
    })
    const kv = createMemoryKv()
    const response = await worker.fetch(request('/xrd-usd'), createEnv(kv))
    const body = await response.json() as { error: string, step: string }

    expect(response.status).toBe(500)
    expect(body.error).toBe('upstream down')
    expect(body.step).toBe('fetchXrdUsdPrice')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(kv.store.size).toBe(0)
  })

  it('still returns 200 when KV get or put throws', async () => {
    const failingGet = createMemoryKv({ throwOnGet: true })
    const getResponse = await worker.fetch(request('/xrd-usd'), createEnv(failingGet))
    expect(getResponse.status).toBe(200)
    expect(fetchXrdUsdPrice).toHaveBeenCalledTimes(1)

    fetchXrdUsdPrice.mockClear()
    const failingPut = createMemoryKv({ throwOnPut: true })
    const putResponse = await worker.fetch(request('/xrd-usd'), createEnv(failingPut))
    expect(putResponse.status).toBe(200)
    expect(fetchXrdUsdPrice).toHaveBeenCalledTimes(1)
  })

  it('uses remaining TTL on cache hit Cache-Control', async () => {
    const kv = createMemoryKv()
    await kv.put('xrd-usd', JSON.stringify({
      ...samplePrice,
      expiresAtUnixMs: Date.now() + 45_000,
    }))

    const response = await worker.fetch(request('/xrd-usd'), createEnv(kv))
    const cacheControl = response.headers.get('Cache-Control') ?? ''
    const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1])

    expect(response.status).toBe(200)
    expect(cacheControl.startsWith('public, max-age=')).toBe(true)
    expect(maxAge).toBeGreaterThan(0)
    expect(maxAge).toBeLessThanOrEqual(45)
    expect(fetchXrdUsdPrice).not.toHaveBeenCalled()
  })

  it('honors CACHE_TTL_SEC on cache write', async () => {
    const kv = createMemoryKv()
    await worker.fetch(request('/xrd-usd'), createEnv(kv, { CACHE_TTL_SEC: '120' }))

    expect(kv.lastPutOptions?.expirationTtl).toBe(120)
  })

  it('passes DISABLE_GATEIO through to fetchXrdUsdPrice', async () => {
    const kv = createMemoryKv()
    await worker.fetch(request('/xrd-usd'), createEnv(kv, { DISABLE_GATEIO: 'true' }))

    expect(fetchXrdUsdPrice.mock.calls[0]?.[0]).toMatchObject({
      disableGateio: true,
    })
  })
})
