/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'
import { ASSETS } from '../src/assets'

describe('ASSETS configuration', () => {
  it('should have valid asset configurations', () => {
    expect(ASSETS.length).toBeGreaterThan(0)

    ASSETS.forEach((asset) => {
      expect(asset.symbol).toBeDefined()
      expect(asset.resourceAddress).toBeDefined()
      expect(asset.resourceAddress).toMatch(/^resource_rdx1/)

      const hasPriceSource = asset.fixedPriceXrd || asset.priceFeeds.length > 0
      expect(hasPriceSource).toBeTruthy()
    })
  })

  it('should have XRD asset with fixed price', () => {
    const xrd = ASSETS.find(asset => asset.symbol === 'XRD')
    expect(xrd).toBeDefined()
    expect(xrd?.fixedPriceXrd).toBe('1')
    expect(xrd?.priceFeeds.map(feed => feed.plugin)).toEqual(['coingecko', 'kucoin', 'gateio'])
  })

  it('does not include pyth feeds', () => {
    for (const asset of ASSETS) {
      expect(asset.priceFeeds.some(feed => feed.plugin === 'pyth')).toBe(false)
    }
  })

  it('puts CoinGecko before CaviarNine on ecosystem tokens', () => {
    const weft = ASSETS.find(asset => asset.symbol === 'WEFT')
    expect(weft?.priceFeeds.map(feed => feed.plugin)).toEqual(['coingecko', 'caviarnine', 'astrolescent'])
  })

  it('should have unique resource addresses', () => {
    const addresses = ASSETS.map(asset => asset.resourceAddress)
    const uniqueAddresses = new Set(addresses)
    expect(uniqueAddresses.size).toBe(addresses.length)
  })

  it('should have valid price feed configurations', () => {
    ASSETS.forEach((asset) => {
      expect(asset.priceFeeds.length).toBeGreaterThan(0)

      asset.priceFeeds.forEach((feed) => {
        expect(feed.plugin).toBeDefined()
        expect(typeof feed.plugin).toBe('string')
        if (feed.identifier !== undefined) {
          expect(typeof feed.identifier).toBe('string')
        }
      })
    })
  })
})
