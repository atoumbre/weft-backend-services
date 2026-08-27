/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { KucoinPlugin } from '../../src/plugins/kucoin'

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const options = { timeoutMs: 5000 }

let originalFetch: typeof globalThis.fetch

describe('KucoinPlugin', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses a successful ticker and converts time ms to unix seconds', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify({
      code: '200000',
      data: {
        time: 1_729_172_965_609,
        price: '0.00092',
      },
    }))))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)
    const result = results.get('XRD-USDT')

    expect(result).toEqual({
      price: '0.00092',
      currency: 'USD',
      publishTime: 1_729_172_965,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=XRD-USDT',
    )
  })

  it('stringifies a numeric price', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      code: '200000',
      data: { time: 1_700_000_000_000, price: 0.001 },
    })))) as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)

    expect(results.get('XRD-USDT')?.price).toBe('0.001')
  })

  it('does not fetch when the identifier list is empty', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('{}')))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch([], options, silentLogger)

    expect(results.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty map for a non-success code', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      code: '400001',
      data: { price: '0.00092' },
    })))) as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map when price is missing', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify({
      code: '200000',
      data: { time: 1_700_000_000_000 },
    })))) as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map on HTTP error without throwing', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response('rate limited', { status: 429 }))) as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map when fetch throws', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('network down'))) as typeof globalThis.fetch

    const plugin = new KucoinPlugin('https://api.kucoin.com')
    const results = await plugin.fetchBatch(['XRD-USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })
})
