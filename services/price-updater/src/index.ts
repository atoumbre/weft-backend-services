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
export { AstrolescentPlugin, CaviarNinePlugin, CoinGeckoPlugin, KucoinPlugin, PluginRegistry, PythPlugin } from './plugins'
export type {
  ILogger,
  PluginFetchOptions,
  PriceCurrency,
  PriceFeedPlugin,
  PriceFeedResult,
} from './plugins'

export { executePriceUpdate } from './pricing'
export type { EnabledPriceSourcePlugins, PriceQuote, PriceResult, PriceSourcePluginName, PriceUpdateConfig } from './pricing'
export {
  canonicalJson,
  createSignedPriceUpdate,
  encodePriceUpdatePayloadSbor,
  hexToBytes,
  toPriceUpdatePayloadSborProgrammaticJson,
} from './producer'
export type { SignedPriceUpdatePayload, SignedPriceUpdatePayloadPrice, SignedPriceUpdateResponse } from './producer'
export { buildManifest } from './transactions'
export { fetchJson, isRecord, optionalEnv, requireEnv } from './utils'
export { fetchXrdUsdPrice } from './xrd-usd'
export type { XrdUsdPrice, XrdUsdPriceConfig } from './xrd-usd'
