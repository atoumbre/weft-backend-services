/// <reference types="bun-types" />

import { createLogger } from '@local-packages/common-utils/logger'
import { describe, expect, it } from 'bun:test'
import { ASSETS, AstrolescentPlugin, CaviarNinePlugin, CoinGeckoPlugin, GateioPlugin, KucoinPlugin, optionalEnv } from '../src'

const logger = createLogger({ service: 'oracle-updater-plugin-test' })
const describeIntegration = process.env.RUN_PRICE_UPDATER_INTEGRATION === 'true' ? describe : describe.skip

describeIntegration('Integration Tests (Real Data)', () => {
  const timeoutMs = 15000
  const options = { timeoutMs }

  it('KucoinPlugin: should fetch real prices from KuCoin for configured CEX pairs', async () => {
    const baseUrl = optionalEnv('KUCOIN_BASE_URL') ?? 'https://api.kucoin.com'
    const plugin = new KucoinPlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds)
      .filter(f => f.plugin === 'kucoin')
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
        logger.info(`KuCoin ${id}: ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`KuCoin identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })

  it('GateioPlugin: should fetch real prices from Gate.io for configured CEX pairs', async () => {
    const baseUrl = optionalEnv('GATEIO_BASE_URL') ?? 'https://api.gateio.ws'
    const plugin = new GateioPlugin(baseUrl)

    const identifiers = ASSETS
      .flatMap(a => a.priceFeeds)
      .filter(f => f.plugin === 'gateio')
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
        logger.info(`Gate.io ${id}: ${result.price} ${result.currency}`)
      }
      else {
        logger.error(`Gate.io identifier not found in results: ${id}`)
      }
    }
  }, { timeout: 30000 })

  it('CoinGeckoPlugin: should fetch real prices from CoinGecko for all configured assets', async () => {
    const baseUrl = optionalEnv('COINGECKO_BASE_URL') ?? 'https://api.coingecko.com'
    const plugin = new CoinGeckoPlugin(baseUrl, optionalEnv('COINGECKO_API_KEY'))

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
