/// <reference types="bun-types" />

import { createLogger } from '@local-packages/common-utils'
import { describe, expect, it } from 'bun:test'
import { ASSETS, AstrolescentPlugin, CaviarNinePlugin, CoinGeckoPlugin, optionalEnv, PythPlugin } from '../src'

const logger = createLogger({ service: 'oracle-updater-plugin-test' })

describe(' Integration Tests (Real Data)', () => {
  const timeoutMs = 15000
  const options = { timeoutMs }

  it('PythPlugin: should fetch real prices from Pyth for all configured assets', async () => {
    const baseUrl = optionalEnv('PYTH_HERMES_URL') ?? 'https://hermes.pyth.network'
    const plugin = new PythPlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds)
      .filter(f => f.plugin === 'pyth')
      .map(f => f.identifier!)
      .filter(Boolean)

    const uniqueIdentifiers = [...new Set(identifiers)]

    const results = await plugin.fetchBatch(uniqueIdentifiers, options, logger)

    expect(results.size).toBeGreaterThan(0)
    for (const id of uniqueIdentifiers) {
      if (results.has(id)) {
        const result = results.get(id)!
        expect(result.price).toBeDefined()
        expect(Number.parseFloat(result.price)).toBeGreaterThan(0)
        expect(result.currency).toBe('USD')
        expect(result.publishTime).toBeGreaterThan(0)
        logger.info(`Pyth ${id}: ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`Pyth identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })

  it('CoinGeckoPlugin: should fetch real prices from CoinGecko for all configured assets', async () => {
    const baseUrl = optionalEnv('COINGECKO_BASE_URL') ?? 'https://api.coingecko.com'
    const plugin = new CoinGeckoPlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds)
      .filter(f => f.plugin === 'coingecko')
      .map(f => f.identifier!)
      .filter(Boolean)

    const uniqueIdentifiers = [...new Set(identifiers)]

    const results = await plugin.fetchBatch(uniqueIdentifiers, options, logger)

    expect(results.size).toBeGreaterThan(0)
    for (const id of uniqueIdentifiers) {
      if (results.has(id)) {
        const result = results.get(id)!
        expect(result.price).toBeDefined()
        expect(Number.parseFloat(result.price)).toBeGreaterThan(0)
        expect(result.currency).toBe('USD')
        logger.info(`CoinGecko ${id}: ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`CoinGecko identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })

  it('AstrolescentPlugin: should fetch real prices from Astrolescent for all configured assets', async () => {
    const baseUrl = optionalEnv('ASTROLESCENT_BASE_URL') ?? 'https://api.astrolescent.com/partner/R96v1uADor/prices'
    const plugin = new AstrolescentPlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds
        .filter(f => f.plugin === 'astrolescent')
        .map(f => f.identifier ?? a.resourceAddress),
      )

    const uniqueIdentifiers = [...new Set(identifiers)]

    const results = await plugin.fetchBatch(uniqueIdentifiers, options, logger)

    expect(results.size).toBeGreaterThan(0)
    for (const id of uniqueIdentifiers) {
      if (results.has(id)) {
        const result = results.get(id)!
        expect(result.price).toBeDefined()
        expect(Number.parseFloat(result.price)).toBeGreaterThan(0)
        expect(result.currency).toBe('XRD')
        logger.info(`Astrolescent ${id}: \n ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`Astrolescent identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })

  it('CaviarNinePlugin: should fetch real prices from CaviarNine for all configured assets', async () => {
    const baseUrl = optionalEnv('CAVIARNINE_BASE_URL') ?? 'https://api.caviarnine.com'
    const plugin = new CaviarNinePlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds
        .filter(f => f.plugin === 'caviarnine')
        .map(f => f.identifier ?? a.resourceAddress),
      )

    const uniqueIdentifiers = [...new Set(identifiers)]

    const results = await plugin.fetchBatch(uniqueIdentifiers, options, logger)

    expect(results.size).toBeGreaterThan(0)
    for (const id of uniqueIdentifiers) {
      if (results.has(id)) {
        const result = results.get(id)!
        expect(result.price).toBeDefined()
        expect(Number.parseFloat(result.price)).toBeGreaterThan(0)
        expect(result.currency).toBe('XRD')
        logger.info(`CaviarNine ${id}: ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`CaviarNine identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })
})
