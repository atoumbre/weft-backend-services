import type { ILogger } from '@local-packages/common-utils/logger'
import type { AssetConfig } from '../assets'
import type { PluginFetchOptions, PriceCurrency, PriceFeedResult } from '../plugins/types'
import { ASSETS } from '../assets'
import { AstrolescentPlugin } from '../plugins/astrolescent'
import { CaviarNinePlugin } from '../plugins/caviarnine'
import { CoinGeckoPlugin } from '../plugins/coingecko'
import { PythPlugin } from '../plugins/pyth'
import { PluginRegistry } from '../plugins/registry'
import { normalizeUsdToXrd } from '../utils'

const NORMALIZED_SCALE = 18
const PLUGIN_PRIORITY = ['pyth', 'caviarnine', 'astrolescent', 'coingecko'] as const

export type PriceSourcePluginName = typeof PLUGIN_PRIORITY[number]
export type EnabledPriceSourcePlugins = Record<PriceSourcePluginName, boolean>

const DEFAULT_ENABLED_PLUGINS: EnabledPriceSourcePlugins = {
  pyth: true,
  caviarnine: true,
  coingecko: true,
  astrolescent: true,
}

function getPluginPriority(pluginName: string): number {
  const index = PLUGIN_PRIORITY.indexOf(pluginName as PriceSourcePluginName)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function isKnownPluginName(pluginName: string): pluginName is PriceSourcePluginName {
  return PLUGIN_PRIORITY.includes(pluginName as PriceSourcePluginName)
}

function resolveEnabledPlugins(enabledPlugins?: Partial<EnabledPriceSourcePlugins>): EnabledPriceSourcePlugins {
  return {
    ...DEFAULT_ENABLED_PLUGINS,
    ...enabledPlugins,
  }
}

export interface PriceQuote {
  symbol: string
  resourceAddress: string
  price: string // Already in target currency (XRD or USD)
  currency: PriceCurrency
  source: string
  publishTime?: number
}

export interface PriceResult {
  symbol: string
  resourceAddress: string
  price: string // Final price in XRD
  source: string
  publishTime?: number
  usdPrice?: string
  xrdUsdPrice?: string
}

export interface PriceUpdateConfig {
  pythBaseUrl: string
  coingeckoBaseUrl: string
  caviarnineBaseUrl: string
  astrolescentBaseUrl: string
  timeoutMs: number
  maxPriceAgeSec?: number
}

async function resolveAssetPrice(
  asset: AssetConfig,
  registry: PluginRegistry,
  options: PluginFetchOptions,
  localLogger: ILogger,
  pluginCaches: Map<string, Map<string, PriceFeedResult>>,
): Promise<PriceQuote | null> {
  // Try each price feed in order
  for (const feed of asset.priceFeeds) {
    const plugin = registry.get(feed.plugin)
    if (!plugin) {
      localLogger[isKnownPluginName(feed.plugin) ? 'debug' : 'error']({
        event: isKnownPluginName(feed.plugin) ? 'oracle.plugin.disabled' : 'oracle.plugin.not_found',
        symbol: asset.symbol,
        pluginName: feed.plugin,
      })
      continue
    }

    // Get or create cache for this plugin
    let cache = pluginCaches.get(feed.plugin)
    if (!cache) {
      cache = new Map()
      pluginCaches.set(feed.plugin, cache)
    }

    // Check cache
    const cached = cache.get(feed.identifier ?? asset.resourceAddress)
    if (cached) {
      // Validate if plugin has validation logic
      const isValid = plugin.isResultValid
        ? plugin.isResultValid(cached, options)
        : true

      if (isValid) {
        localLogger.info({ event: 'oracle.price.resolved', symbol: asset.symbol, source: feed.plugin, currency: cached.currency, fromCache: true })

        return {
          symbol: asset.symbol,
          resourceAddress: asset.resourceAddress,
          price: cached.price,
          currency: cached.currency,
          source: feed.plugin,
          publishTime: cached.publishTime,
        }
      }
      else {
        localLogger.info({ event: 'oracle.price.stale', symbol: asset.symbol, source: feed.plugin })
      }
    }
  }

  // No valid price found
  localLogger.error({
    event: 'oracle.price.failed',
    symbol: asset.symbol,
    resourceAddress: asset.resourceAddress,
    triedSources: asset.priceFeeds.map(f => f.plugin).filter(pluginName => registry.has(pluginName)),
  })

  return null
}

function findXrdUsdPrice(
  pluginCaches: Map<string, Map<string, PriceFeedResult>>,
  registry: PluginRegistry,
  options: PluginFetchOptions,
  localLogger: ILogger,
): { price: string, source: string } | null {
  const xrdAsset = ASSETS.find(asset => asset.symbol === 'XRD')
  if (!xrdAsset)
    return null

  for (const feed of xrdAsset.priceFeeds) {
    const plugin = registry.get(feed.plugin)
    if (!plugin)
      continue

    const cache = pluginCaches.get(feed.plugin)
    const identifier = feed.identifier ?? xrdAsset.resourceAddress
    const result = cache?.get(identifier)

    const isValid = result && plugin.isResultValid
      ? plugin.isResultValid(result, options)
      : true

    if (result?.currency === 'USD' && isValid) {
      localLogger.info({ event: 'oracle.price.xrd_usd.found_in_cache', source: feed.plugin, identifier, price: result.price })
      return { price: result.price, source: feed.plugin }
    }
  }

  return null
}

async function prefetchAllPluginData(
  assets: AssetConfig[],
  registry: PluginRegistry,
  options: PluginFetchOptions,
  localLogger: ILogger,
): Promise<Map<string, Map<string, PriceFeedResult>>> {
  const pluginCaches = new Map<string, Map<string, PriceFeedResult>>()
  const resolvedAssetAddresses = new Set<string>()

  // order based on priority in PLUGIN_PRIORITY
  const pluginNames = registry.keys().sort((a, b) => getPluginPriority(a) - getPluginPriority(b))

  for (const pluginName of pluginNames) {
    const plugin = registry.get(pluginName)
    if (!plugin)
      continue

    // Find assets that need fetching from this plugin
    const identifierToAssets = new Map<string, Set<string>>() // identifier -> Set of resourceAddresses

    for (const asset of assets) {
      // If already resolved by a higher priority plugin, skip
      if (resolvedAssetAddresses.has(asset.resourceAddress))
        continue

      const feed = asset.priceFeeds.find(f => f.plugin === pluginName)
      if (feed) {
        const normalizedId = feed.identifier ?? asset.resourceAddress

        let assetSet = identifierToAssets.get(normalizedId)
        if (!assetSet) {
          assetSet = new Set()
          identifierToAssets.set(normalizedId, assetSet)
        }
        assetSet.add(asset.resourceAddress)
      }
    }

    if (identifierToAssets.size === 0)
      continue

    localLogger.info({ event: 'oracle.fetch.batch.start', plugin: pluginName, count: identifierToAssets.size })

    try {
      const results = await plugin.fetchBatch(
        Array.from(identifierToAssets.keys()),
        options,
        localLogger,
      )

      // Get or create cache for this plugin
      let cache = pluginCaches.get(pluginName)
      if (!cache) {
        cache = new Map()
        pluginCaches.set(pluginName, cache)
      }

      // Process results and mark assets as resolved if valid
      for (const [identifier, result] of results.entries()) {
        cache.set(identifier, result)

        const assetAddresses = identifierToAssets.get(identifier)
        if (assetAddresses) {
          const isValid = plugin.isResultValid
            ? plugin.isResultValid(result, options)
            : true

          if (isValid) {
            for (const address of assetAddresses) {
              resolvedAssetAddresses.add(address)
            }
          }
        }
      }

      localLogger.info({ event: 'oracle.fetch.batch.success', plugin: pluginName, fetchedCount: results.size, resolvedCount: Array.from(identifierToAssets.values()).reduce((acc, set) => acc + set.size, 0) })
    }
    catch (error) {
      localLogger.error({ event: 'oracle.fetch.batch.failed', plugin: pluginName, err: error })
    }
  }

  return pluginCaches
}

export async function executePriceUpdate(
  params: {
    config: PriceUpdateConfig
    logger: ILogger
    enabledPlugins?: Partial<EnabledPriceSourcePlugins>
  },

) {
  const { config, logger: localLogger } = params
  const enabledPlugins = resolveEnabledPlugins(params.enabledPlugins)

  if (
    !enabledPlugins.pyth
    && !enabledPlugins.caviarnine
    && !enabledPlugins.coingecko
    && !enabledPlugins.astrolescent
  ) {
    localLogger.error({ event: 'oracle.price.failed', error: 'No plugins enabled' })
    throw new Error('No plugins enabled')
  }

  const options: PluginFetchOptions = {
    timeoutMs: config.timeoutMs,
    maxPriceAgeSec: config.maxPriceAgeSec,
  }

  // Initialize plugin registry
  const registry = new PluginRegistry()
  if (enabledPlugins.pyth) {
    registry.register(new PythPlugin(config.pythBaseUrl))
  }
  if (enabledPlugins.caviarnine) {
    registry.register(new CaviarNinePlugin(config.caviarnineBaseUrl))
  }
  if (enabledPlugins.coingecko) {
    registry.register(new CoinGeckoPlugin(config.coingeckoBaseUrl))
  }
  if (enabledPlugins.astrolescent) {
    registry.register(new AstrolescentPlugin(config.astrolescentBaseUrl))
  }

  localLogger.info({ event: 'oracle.fetch.start', assetCount: ASSETS.length, enabledPlugins })

  // Prefetch all plugin data in parallel
  const pluginCaches = await prefetchAllPluginData(ASSETS, registry, options, localLogger)

  // Find the XRD/USD reference only when an enabled USD source provided one.
  let xrdUsdResult = findXrdUsdPrice(pluginCaches, registry, options, localLogger)
  let xrdUsdPrice = xrdUsdResult?.price
  if (xrdUsdResult) {
    localLogger.info({ event: 'oracle.price.xrd_usd', price: xrdUsdResult.price, source: xrdUsdResult.source })
  }

  // Process all assets
  const prices: PriceResult[] = []

  for (const asset of ASSETS) {
    // Handle fixed price assets
    if (asset.fixedPriceXrd) {
      prices.push({
        symbol: asset.symbol,
        resourceAddress: asset.resourceAddress,
        price: asset.fixedPriceXrd,
        source: 'fixed',
      })
      continue
    }

    // Get price with fallback
    const quote = await resolveAssetPrice(asset, registry, options, localLogger, pluginCaches)
    if (!quote)
      continue

    // If price is already in XRD, use it directly
    if (quote.currency === 'XRD') {
      prices.push({
        symbol: asset.symbol,
        resourceAddress: asset.resourceAddress,
        price: quote.price,
        source: quote.source,
        publishTime: quote.publishTime,
      })
      continue
    }

    // If price is in USD, normalize to XRD
    if (!xrdUsdPrice) {
      xrdUsdResult = findXrdUsdPrice(pluginCaches, registry, options, localLogger)
      xrdUsdPrice = xrdUsdResult?.price
      if (!xrdUsdPrice) {
        throw new Error('No XRD/USD price found in cache to normalize USD prices')
      }
      localLogger.info({ event: 'oracle.price.xrd_usd', price: xrdUsdPrice, source: xrdUsdResult?.source })
    }

    const normalized = normalizeUsdToXrd(quote.price, xrdUsdPrice, NORMALIZED_SCALE)

    prices.push({
      symbol: asset.symbol,
      resourceAddress: asset.resourceAddress,
      price: normalized,
      source: quote.source,
      publishTime: quote.publishTime,
      usdPrice: quote.price,
      xrdUsdPrice,
    })
  }

  if (prices.length === 0) {
    throw new Error('No prices were successfully fetched')
  }

  return { prices, xrdUsdPrice }
}
