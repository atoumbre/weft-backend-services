/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { executePriceUpdate } from '../../src/pricing'

const mockCoinGeckoResponse = {
  'radix': { usd: 0.45 },
  'tether': { usd: 1.0 },
  'usd-coin': { usd: 0.9995 },
  'ethereum': { usd: 3500 },
  'bitcoin': { usd: 65000 },
  'solana': { usd: 150 },
}

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
  caviarnineBaseUrl: 'https://api.caviarnine.com',
  astrolescentBaseUrl: 'https://api.astrolescent.com/partner/test/prices',
  timeoutMs: 5000,
}

let originalFetch: typeof globalThis.fetch

function kucoinTicker(price: string) {
  return new Response(JSON.stringify({
    code: '200000',
    data: { price, time: Date.now() },
  }))
}

function gateioTicker(currencyPair: string, last: string) {
  return new Response(JSON.stringify([{ currency_pair: currencyPair, last }]))
}

describe('executePriceUpdate', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should successfully fetch prices from mocked plugins', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('coingecko.com')) {
        return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
      }
      if (url.includes('kucoin.com')) {
        return Promise.resolve(kucoinTicker('0.45'))
      }
      if (url.includes('gateio.ws')) {
        return Promise.resolve(gateioTicker('XRD_USDT', '0.45'))
      }
      if (url.includes('caviarnine.com')) {
        return Promise.resolve(new Response(JSON.stringify({ result: { status: 'Succeeded', details: { mid_price_buy_to_sell: '1.5' }, header: { unix_timestamp_ms: Date.now() } } })))
      }
      if (url.includes('astrolescent.com')) {
        return Promise.resolve(new Response(JSON.stringify({})))
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await executePriceUpdate({
      config,
      enabledPlugins: {
        coingecko: true,
        kucoin: false,
        gateio: false,
        caviarnine: false,
        astrolescent: true,
      },
      logger: silentLogger,
    })

    expect(result.prices).toBeDefined()
    expect(Array.isArray(result.prices)).toBe(true)
    expect(result.prices.length).toBeGreaterThan(0)
    expect(result.xrdUsdPrice).toBeDefined()
    expect(fetchMock).toHaveBeenCalled()

    const calledUrls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(calledUrls.some(url => url.includes('coingecko.com'))).toBe(true)
    expect(calledUrls.every(url => !url.includes('pyth'))).toBe(true)
  })

  it('should handle API failures gracefully with fallback', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('coingecko.com')) {
        return Promise.reject(new Error('CoinGecko API Error'))
      }
      if (url.includes('kucoin.com')) {
        return Promise.resolve(kucoinTicker('1.0'))
      }
      if (url.includes('gateio.ws')) {
        return Promise.resolve(gateioTicker('XRD_USDT', '1.0'))
      }
      if (url.includes('caviarnine.com')) {
        return Promise.resolve(new Response(JSON.stringify({ result: { status: 'Succeeded', details: { mid_price_buy_to_sell: '1.5' }, header: { unix_timestamp_ms: Date.now() } } })))
      }
      if (url.includes('astrolescent.com')) {
        return Promise.resolve(new Response(JSON.stringify({})))
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await executePriceUpdate({
      config,
      enabledPlugins: {
        coingecko: true,
        kucoin: true,
        gateio: false,
        caviarnine: false,
        astrolescent: false,
      },
      logger: silentLogger,
    })

    expect(result.prices).toBeDefined()
    expect(result.prices.length).toBeGreaterThan(0)

    const nonFixedPrices = result.prices.filter(price => price.source !== 'fixed')
    expect(nonFixedPrices.length).toBeGreaterThan(0)
    nonFixedPrices.forEach((price) => {
      expect(['coingecko', 'kucoin', 'gateio', 'caviarnine', 'astrolescent']).toContain(price.source)
    })
  })

  it('should not fetch disabled plugins and should allow XRD-only source plugins', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('caviarnine.com')) {
        return Promise.resolve(new Response(JSON.stringify({ result: { status: 'Succeeded', details: { mid_price_buy_to_sell: '1.5' }, header: { unix_timestamp_ms: Date.now() } } })))
      }
      return Promise.reject(new Error(`Disabled or unknown plugin fetched: ${url}`))
    })

    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const result = await executePriceUpdate({
      config,
      enabledPlugins: {
        coingecko: false,
        kucoin: false,
        gateio: false,
        caviarnine: true,
        astrolescent: false,
      },
      logger: silentLogger,
    })

    expect(result.prices.length).toBeGreaterThan(1)
    expect(result.xrdUsdPrice).toBeUndefined()
    expect(fetchMock).toHaveBeenCalled()

    const calledUrls = fetchMock.mock.calls.map(call => String(call[0]))
    expect(calledUrls.every(url => url.includes('caviarnine.com'))).toBe(true)

    const nonFixedPrices = result.prices.filter(price => price.source !== 'fixed')
    expect(nonFixedPrices.length).toBeGreaterThan(0)
    nonFixedPrices.forEach((price) => {
      expect(price.source).toBe('caviarnine')
    })
  })

  it('should reject configurations with no enabled plugins', async () => {
    await expect(executePriceUpdate({
      config,
      enabledPlugins: {
        coingecko: false,
        kucoin: false,
        gateio: false,
        caviarnine: false,
        astrolescent: false,
      },
      logger: silentLogger,
    })).rejects.toThrow('No plugins enabled')
  })
})
