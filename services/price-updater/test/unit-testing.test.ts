/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ASSETS, buildManifest, executePriceUpdate, isRecord, optionalEnv, requireEnv } from '../src'

// Mock environment variables
const mockEnv = {
  ACCOUNT_ADDRESS: 'account_rdx1234567890abcdef',
  BADGE_RESOURCE_ADDRESS: 'resource_rdx1badge123',
  ORACLE_COMPONENT_ADDRESS: 'component_rdx1oracle123',
  BADGE_NFT_ID: '#1#',
  PYTH_HERMES_URL: 'https://hermes.pyth.network',
  COINGECKO_BASE_URL: 'https://api.coingecko.com',
  CAVIARNINE_BASE_URL: 'https://api.caviarnine.com',
  PRICE_FETCH_TIMEOUT_MS: '8000',
  PYTH_MAX_AGE_SEC: '60',
  ASTROLESCENT_BASE_URL: 'https://api.astrolescent.com/partner/R96v1uADor/prices',
}

let originalEnv: Record<string, string | undefined>
let originalFetch: typeof global.fetch

// Mock Pyth API response
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

// Mock CoinGecko API response
const mockCoinGeckoResponse = {
  'radix': { usd: 0.45 },
  'tether': { usd: 1.0 },
  'usd-coin': { usd: 0.9995 },
  'ethereum': { usd: 3500 },
}

// Mock logger
const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

describe('Oracle Price Updater Service', () => {
  beforeEach(() => {
    originalEnv = { ...process.env }
    Object.assign(process.env, mockEnv)
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
  })

  describe('Utility Functions', () => {
    it('requireEnv should return env value when set', () => {
      process.env.TEST_VAR = 'test_value'
      expect(requireEnv('TEST_VAR')).toBe('test_value')
    })

    it('requireEnv should throw when env value missing', () => {
      delete process.env.TEST_VAR
      expect(() => requireEnv('TEST_VAR')).toThrow('Missing required env var: TEST_VAR')
    })

    it('optionalEnv should return env value when set', () => {
      process.env.OPTIONAL_VAR = 'optional_value'
      expect(optionalEnv('OPTIONAL_VAR')).toBe('optional_value')
    })

    it('optionalEnv should return undefined when not set', () => {
      delete process.env.OPTIONAL_VAR
      expect(optionalEnv('OPTIONAL_VAR')).toBeUndefined()
    })

    it('optionalEnv should return undefined for empty string', () => {
      process.env.OPTIONAL_VAR = '   '
      expect(optionalEnv('OPTIONAL_VAR')).toBeUndefined()
    })

    it('isRecord should identify objects correctly', () => {
      expect(isRecord({})).toBe(true)
      expect(isRecord({ key: 'value' })).toBe(true)
      expect(isRecord(null)).toBe(false)
      expect(isRecord(undefined)).toBe(false)
      expect(isRecord('string')).toBe(false)
      expect(isRecord(123)).toBe(false)
      expect(isRecord([])).toBe(true) // Arrays are objects
    })
  })

  describe('ASSETS Configuration', () => {
    it('should have valid asset configurations', () => {
      expect(ASSETS.length).toBeGreaterThan(0)

      ASSETS.forEach((asset) => {
        expect(asset.symbol).toBeDefined()
        expect(asset.resourceAddress).toBeDefined()
        expect(asset.resourceAddress).toMatch(/^resource_rdx1/)

        // At least one price source should be defined
        const hasPriceSource
          = asset.fixedPriceXrd
            || (asset.priceFeeds && asset.priceFeeds.length > 0)
        expect(hasPriceSource).toBeTruthy()
      })
    })

    it('should have XRD asset with fixed price', () => {
      const xrd = ASSETS.find(a => a.symbol === 'XRD')
      expect(xrd).toBeDefined()
      expect(xrd?.fixedPriceXrd).toBe('1')
    })

    it('should have unique resource addresses', () => {
      const addresses = ASSETS.map(a => a.resourceAddress)
      const uniqueAddresses = new Set(addresses)
      expect(uniqueAddresses.size).toBe(addresses.length)
    })

    it('should have valid price feed configurations', () => {
      ASSETS.forEach((asset) => {
        if (asset.priceFeeds) {
          expect(asset.priceFeeds.length).toBeGreaterThan(0)
          asset.priceFeeds.forEach((feed) => {
            expect(feed.plugin).toBeDefined()
            expect(typeof feed.plugin).toBe('string')
            if (feed.identifier !== undefined) {
              expect(typeof feed.identifier).toBe('string')
            }
          })
        }
      })
    })
  })

  describe('buildManifest', () => {
    it('should generate valid Radix manifest', () => {
      const prices = [
        { symbol: 'XRD', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', price: '1', source: 'fixed' },
        { symbol: 'xUSDT', resourceAddress: 'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', price: '2.22', source: 'pyth' },
      ]

      const manifest = buildManifest({
        accountAddress: mockEnv.ACCOUNT_ADDRESS,
        badgeResourceAddress: mockEnv.BADGE_RESOURCE_ADDRESS,
        badgeId: mockEnv.BADGE_NFT_ID,
        oracleComponentAddress: mockEnv.ORACLE_COMPONENT_ADDRESS,
        prices,
      })

      expect(manifest).toContain('CALL_METHOD')
      expect(manifest).toContain('create_proof_of_non_fungibles')
      expect(manifest).toContain('update_prices')
      expect(manifest).toContain(mockEnv.ACCOUNT_ADDRESS)
      expect(manifest).toContain(mockEnv.ORACLE_COMPONENT_ADDRESS)
      expect(manifest).toContain(mockEnv.BADGE_RESOURCE_ADDRESS)

      prices.forEach((price) => {
        expect(manifest).toContain(price.resourceAddress)
        expect(manifest).toContain(`Decimal("${price.price}")`)
      })
    })
  })

  describe('executePriceUpdate', () => {
    it('should successfully fetch prices from mocked plugins', async () => {
      const fetchMock = mock((url: string) => {
        if (url.includes('pyth.network') || url.includes('hermes.pyth.network')) {
          return Promise.resolve(new Response(JSON.stringify(mockPythResponse)))
        }
        else if (url.includes('coingecko.com')) {
          return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
        }
        else if (url.includes('caviarnine.com')) {
          return Promise.resolve(new Response(JSON.stringify({ result: { status: 'Succeeded', details: { mid_price_buy_to_sell: '1.5' }, header: { unix_timestamp_ms: Date.now() } } })))
        }
        else if (url.includes('astrolescent.com')) {
          return Promise.resolve(new Response(JSON.stringify({})))
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      globalThis.fetch = fetchMock as any

      const result = await executePriceUpdate({
        config: {
          pythBaseUrl: 'https://hermes.pyth.network',
          coingeckoBaseUrl: 'https://api.coingecko.com',
          caviarnineBaseUrl: 'https://api.caviarnine.com',
          astrolescentBaseUrl: 'https://api.astrolescent.com/partner/test/prices',
          timeoutMs: 5000,
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
        else if (url.includes('coingecko.com')) {
          return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
        }
        else if (url.includes('caviarnine.com')) {
          return Promise.resolve(new Response(JSON.stringify({ result: { status: 'Succeeded', details: { mid_price_buy_to_sell: '1.5' }, header: { unix_timestamp_ms: Date.now() } } })))
        }
        else if (url.includes('astrolescent.com')) {
          return Promise.resolve(new Response(JSON.stringify({})))
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      globalThis.fetch = fetchMock as any

      const result = await executePriceUpdate({
        config: {
          pythBaseUrl: 'https://hermes.pyth.network',
          coingeckoBaseUrl: 'https://api.coingecko.com',
          caviarnineBaseUrl: 'https://api.caviarnine.com',
          astrolescentBaseUrl: 'https://api.astrolescent.com/partner/test/prices',
          timeoutMs: 5000,
        },
        logger: silentLogger,
      })

      expect(result.prices).toBeDefined()
      expect(result.prices.length).toBeGreaterThan(0)

      // Should have fallen back to coingecko/caviarnine
      const nonFixedPrices = result.prices.filter(p => p.source !== 'fixed')
      expect(nonFixedPrices.length).toBeGreaterThan(0)
      nonFixedPrices.forEach((price) => {
        expect(['coingecko', 'caviarnine', 'astrolescent']).toContain(price.source)
      })
    })
  })
})
