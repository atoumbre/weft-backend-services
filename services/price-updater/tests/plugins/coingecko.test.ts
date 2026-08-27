/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { CoinGeckoPlugin } from '../../src/plugins/coingecko'

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const options = { timeoutMs: 5000 }

let originalFetch: typeof globalThis.fetch

describe('CoinGeckoPlugin', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns USD for radix without an API key header', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({
      radix: { usd: 0.00092 },
    }))))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new CoinGeckoPlugin('https://api.coingecko.com')
    const results = await plugin.fetchBatch(['radix'], options, silentLogger)

    expect(results.get('radix')).toEqual({
      price: '0.00092',
      currency: 'USD',
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const headers = new Headers(init?.headers)
    expect(headers.has('x-cg-demo-api-key')).toBe(false)
  })

  it('sends x-cg-demo-api-key when an API key is configured', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({
      radix: { usd: 0.00092 },
    }))))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new CoinGeckoPlugin('https://api.coingecko.com', 'demo-key')
    await plugin.fetchBatch(['radix'], options, silentLogger)

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const headers = new Headers(init?.headers)
    expect(headers.get('x-cg-demo-api-key')).toBe('demo-key')
  })

  it('returns an empty map on HTTP 429', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response('rate limited', { status: 429 }))) as typeof globalThis.fetch

    const plugin = new CoinGeckoPlugin('https://api.coingecko.com')
    const results = await plugin.fetchBatch(['radix'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map for an invalid payload', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({ radix: { eur: 1 } })))) as typeof globalThis.fetch

    const plugin = new CoinGeckoPlugin('https://api.coingecko.com')
    const results = await plugin.fetchBatch(['radix'], options, silentLogger)

    expect(results.size).toBe(0)
  })
})
