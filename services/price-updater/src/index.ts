/**
 * Price Updater Service
 *
 * Platform-agnostic price updating logic for the Weft Oracle.
 * This module fetches prices from multiple sources, normalizes them,
 * and generates Radix transaction manifests.
 */

export type { AssetConfig, AssetPriceFeed } from './assets'
export { ASSETS } from './assets'
export { runPriceUpdate, toPriceUpdateError, toWorkerError } from './execution'
export type {
  NetworkName,
  PriceUpdateError,
  PriceUpdateResponse,
  PriceUpdateRunnerConfig,
  WorkerConfig,
  WorkerError,
} from './execution'

// Plugin exports
export { AstrolescentPlugin, CaviarNinePlugin, CoinGeckoPlugin, PluginRegistry, PythPlugin } from './plugins'
export type {
  ILogger,
  PluginFetchOptions,
  PriceCurrency,
  PriceFeedPlugin,
  PriceFeedResult,
} from './plugins'

export { executePriceUpdate } from './pricing'
export type { EnabledPriceSourcePlugins, PriceQuote, PriceResult, PriceSourcePluginName, PriceUpdateConfig } from './pricing'
export { buildManifest } from './transactions'
export { fetchJson, isRecord, optionalEnv, requireEnv } from './utils'
