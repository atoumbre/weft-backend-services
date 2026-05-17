/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { executePriceUpdate } from '../../src/pricing'

const mockPythResponse = {
  parsed: [
    {
      id: '0x816c6604beb161d3ad9c3b584f06c682e6299516165d756a68c7660b073b7072',
      price: {
        price: '45000000',
        expo: -8,
        publish_time: Math.floor(Date.now() / 1000) - 10,
      },
    },
    {
      id: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
      price: {
        price: '100000000',
        expo: -8,
        publish_time: Math.floor(Date.now() / 1000) - 5,
      },
    },
  ],
}

const mockCoinGeckoResponse = {
  'radix': { usd: 0.45 },
  'tether': { usd: 1.0 },
  'usd-coin': { usd: 0.9995 },
  'ethereum': { usd: 3500 },
}

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const config = {
  pythBaseUrl: 'https://hermes.pyth.network',
  coingeckoBaseUrl: 'https://api.coingecko.com',
  caviarnineBaseUrl: 'https://api.caviarnine.com',
  astrolescentBaseUrl: 'https://api.astrolescent.com/partner/test/prices',
  timeoutMs: 5000,
}

let originalFetch: typeof globalThis.fetch

describe('executePriceUpdate', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('should successfully fetch prices from mocked plugins', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('pyth.network') || url.includes('hermes.pyth.network')) {
        return Promise.resolve(new Response(JSON.stringify(mockPythResponse)))
      }
      if (url.includes('coingecko.com')) {
        return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
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
        pyth: true,
        coingecko: true,
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
  })

  it('should handle API failures gracefully with fallback', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('pyth.network') || url.includes('hermes.pyth.network')) {
        return Promise.reject(new Error('Pyth API Error'))
      }
      if (url.includes('coingecko.com')) {
        return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
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
        pyth: true,
        coingecko: true,
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
      expect(['coingecko', 'caviarnine', 'astrolescent']).toContain(price.source)
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
        pyth: false,
        coingecko: false,
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
        pyth: false,
        coingecko: false,
        caviarnine: false,
        astrolescent: false,
      },
      logger: silentLogger,
    })).rejects.toThrow('No plugins enabled')
  })
})
