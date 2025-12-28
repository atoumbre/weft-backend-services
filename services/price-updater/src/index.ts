/**
 * Price Updater Service
 *
 * Platform-agnostic price updating logic for the Weft Oracle.
 * This module fetches prices from multiple sources, normalizes them,
 * and generates Radix transaction manifests.
 */

export { PluginRegistry } from './plugin-interface'
export type {
  ILogger,
  PluginFetchOptions,
  PriceCurrency,
  PriceFeedPlugin,
  PriceFeedResult,
} from './plugin-interface'

// Plugin exports
export { AstrolescentPlugin } from './plugins/astrolescent'
export { CaviarNinePlugin } from './plugins/caviarnine'

export { CoinGeckoPlugin } from './plugins/coingecko'
export { PythPlugin } from './plugins/pyth'

export { buildManifest, executePriceUpdate } from './price-service'

export type { PriceQuote, PriceResult, PriceUpdateConfig } from './price-service'
export type { AssetConfig, AssetPriceFeed } from './tokens'
export { ASSETS } from './tokens'
export { fetchJson, isRecord, optionalEnv, requireEnv } from './utils'
