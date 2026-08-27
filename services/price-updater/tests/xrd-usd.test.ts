/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { fetchXrdUsdPrice } from '../src/xrd-usd'

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const config = {
  coingeckoBaseUrl: 'https://api.coingecko.com',
  kucoinBaseUrl: 'https://api.kucoin.com',
  gateioBaseUrl: 'https://api.gateio.ws',
  timeoutMs: 5000,
}

let originalFetch: typeof globalThis.fetch

function mockFetchByHost(handlers: {
  coingecko?: () => Promise<Response>
  kucoin?: () => Promise<Response>
  gateio?: () => Promise<Response>
}) {
  return mock((url: string) => {
    const href = String(url)
    if (href.includes('coingecko.com')) {
      if (!handlers.coingecko)
        return Promise.reject(new Error('unexpected CoinGecko request'))
      return handlers.coingecko()
    }
    if (href.includes('kucoin.com')) {
      if (!handlers.kucoin)
        return Promise.reject(new Error('unexpected KuCoin request'))
      return handlers.kucoin()
    }
    if (href.includes('gateio.ws')) {
      if (!handlers.gateio)
        return Promise.reject(new Error('unexpected Gate.io request'))
      return handlers.gateio()
    }
    if (href.includes('pyth') || href.includes('caviarnine') || href.includes('astrolescent'))
      return Promise.reject(new Error(`unexpected origin request: ${href}`))
    return Promise.reject(new Error(`Unknown URL: ${href}`))
  })
}

describe('fetchXrdUsdPrice', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns CoinGecko XRD/USD on a hit', async () => {
    const fetchMock = mockFetchByHost({
      coingecko: () => Promise.resolve(new Response(JSON.stringify({ radix: { usd: 0.00092 } }))),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await fetchXrdUsdPrice(config, silentLogger)

    expect(result.symbol).toBe('XRD')
    expect(result.currency).toBe('USD')
    expect(result.price).toBe('0.00092')
    expect(result.source).toBe('coingecko')
    expect(Number.isFinite(result.fetchedAtUnixMs)).toBe(true)
    expect(fetchMock.mock.calls.map(call => String(call[0])).every(url => url.includes('coingecko.com'))).toBe(true)
  })

  it('falls back to KuCoin when CoinGecko returns 429', async () => {
    const fetchMock = mockFetchByHost({
      coingecko: () => Promise.resolve(new Response('rate limited', { status: 429 })),
      kucoin: () => Promise.resolve(new Response(JSON.stringify({
        code: '200000',
        data: { price: '0.00091', time: 1_729_172_965_609 },
      }))),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await fetchXrdUsdPrice(config, silentLogger)

    expect(result.source).toBe('kucoin')
    expect(result.price).toBe('0.00091')
    expect(result.publishTime).toBe(1_729_172_965)

    const calledUrls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(calledUrls[0]).toContain('coingecko.com')
    expect(calledUrls[1]).toContain('kucoin.com')
  })

  it('falls back to Gate.io when CoinGecko and KuCoin fail', async () => {
    const fetchMock = mockFetchByHost({
      coingecko: () => Promise.resolve(new Response('rate limited', { status: 429 })),
      kucoin: () => Promise.resolve(new Response('down', { status: 500 })),
      gateio: () => Promise.resolve(new Response(JSON.stringify([
        { currency_pair: 'XRD_USDT', last: '0.00090' },
      ]))),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await fetchXrdUsdPrice(config, silentLogger)

    expect(result.source).toBe('gateio')
    expect(result.price).toBe('0.00090')

    const calledUrls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(calledUrls[0]).toContain('coingecko.com')
    expect(calledUrls[1]).toContain('kucoin.com')
    expect(calledUrls[2]).toContain('gateio.ws')
  })

  it('throws when all sources fail', async () => {
    globalThis.fetch = mockFetchByHost({
      coingecko: () => Promise.resolve(new Response('rate limited', { status: 429 })),
      kucoin: () => Promise.resolve(new Response('down', { status: 500 })),
      gateio: () => Promise.resolve(new Response('down', { status: 500 })),
    }) as typeof globalThis.fetch

    await expect(fetchXrdUsdPrice(config, silentLogger)).rejects.toThrow('No XRD/USD price found')
  })

  it('does not call CoinGecko when disableCoinGecko is set', async () => {
    const fetchMock = mockFetchByHost({
      kucoin: () => Promise.resolve(new Response(JSON.stringify({
        code: '200000',
        data: { price: '0.00091', time: 1_700_000_000_000 },
      }))),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await fetchXrdUsdPrice({ ...config, disableCoinGecko: true }, silentLogger)

    expect(result.source).toBe('kucoin')
    expect(fetchMock.mock.calls.map(call => String(call[0])).every(url => url.includes('kucoin.com'))).toBe(true)
  })

  it('does not call KuCoin when disableKucoin is set and throws if CoinGecko and Gate.io fail', async () => {
    const fetchMock = mockFetchByHost({
      coingecko: () => Promise.resolve(new Response('rate limited', { status: 429 })),
      gateio: () => Promise.resolve(new Response('down', { status: 500 })),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    await expect(fetchXrdUsdPrice({ ...config, disableKucoin: true }, silentLogger)).rejects.toThrow('No XRD/USD price found')
    expect(fetchMock.mock.calls.map(call => String(call[0])).every(url => !url.includes('kucoin.com'))).toBe(true)
  })

  it('uses Gate.io when CoinGecko and KuCoin are disabled', async () => {
    const fetchMock = mockFetchByHost({
      gateio: () => Promise.resolve(new Response(JSON.stringify([
        { currency_pair: 'XRD_USDT', last: '0.00089' },
      ]))),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await fetchXrdUsdPrice({
      ...config,
      disableCoinGecko: true,
      disableKucoin: true,
    }, silentLogger)

    expect(result.source).toBe('gateio')
    expect(result.price).toBe('0.00089')
    expect(fetchMock.mock.calls.map(call => String(call[0])).every(url => url.includes('gateio.ws'))).toBe(true)
  })
})
