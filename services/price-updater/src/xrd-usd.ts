import type { ILogger } from './plugins/types'
import { CoinGeckoPlugin } from './plugins/coingecko'
import { KucoinPlugin } from './plugins/kucoin'

const COINGECKO_XRD_ID = 'radix'
const KUCOIN_XRD_USDT_SYMBOL = 'XRD-USDT'

export interface XrdUsdPriceConfig {
  coingeckoBaseUrl: string
  coingeckoApiKey?: string
  kucoinBaseUrl: string
  timeoutMs: number
  disableCoinGecko?: boolean
  disableKucoin?: boolean
}

export interface XrdUsdPrice {
  symbol: 'XRD'
  currency: 'USD'
  price: string
  source: string
  publishTime?: number
  fetchedAtUnixMs: number
}

export async function fetchXrdUsdPrice(
  config: XrdUsdPriceConfig,
  logger: ILogger,
): Promise<XrdUsdPrice> {
  const options = { timeoutMs: config.timeoutMs }
  const fetchedAtUnixMs = Date.now()

  if (!config.disableCoinGecko) {
    const plugin = new CoinGeckoPlugin(config.coingeckoBaseUrl, config.coingeckoApiKey)
    const results = await plugin.fetchBatch([COINGECKO_XRD_ID], options, logger)
    const result = results.get(COINGECKO_XRD_ID)
    if (result?.currency === 'USD' && result.price) {
      logger.info({ event: 'xrd_usd.fetched', source: 'coingecko', price: result.price })
      return {
        symbol: 'XRD',
        currency: 'USD',
        price: result.price,
        source: 'coingecko',
        publishTime: result.publishTime,
        fetchedAtUnixMs,
      }
    }
  }

  if (!config.disableKucoin) {
    const plugin = new KucoinPlugin(config.kucoinBaseUrl)
    const results = await plugin.fetchBatch([KUCOIN_XRD_USDT_SYMBOL], options, logger)
    const result = results.get(KUCOIN_XRD_USDT_SYMBOL)
    if (result?.currency === 'USD' && result.price) {
      logger.info({ event: 'xrd_usd.fetched', source: 'kucoin', price: result.price })
      return {
        symbol: 'XRD',
        currency: 'USD',
        price: result.price,
        source: 'kucoin',
        publishTime: result.publishTime,
        fetchedAtUnixMs,
      }
    }
  }

  throw new Error('No XRD/USD price found from CoinGecko or KuCoin')
}
