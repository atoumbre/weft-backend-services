import type { ILogger, PluginFetchOptions, PriceCurrency, PriceFeedPlugin, PriceFeedResult } from './types'

import { fetchJson, isRecord } from '../utils'

const SUCCESS_CODE = '200000'

export class KucoinPlugin implements PriceFeedPlugin {
  name = 'kucoin'
  currency: PriceCurrency = 'USD'

  constructor(private baseUrl: string) { }

  async fetchBatch(
    identifiers: string[],
    options: PluginFetchOptions,
    localLogger: ILogger,
  ): Promise<Map<string, PriceFeedResult>> {
    const map = new Map<string, PriceFeedResult>()
    const uniqueIds = Array.from(new Set(identifiers.filter(Boolean)))
    if (uniqueIds.length === 0)
      return map

    await Promise.all(uniqueIds.map(async (identifier) => {
      try {
        const result = await this.fetchTicker(identifier, options.timeoutMs, localLogger)
        if (result)
          map.set(identifier, result)
      }
      catch (error) {
        localLogger.error({ event: 'oracle.plugin.kucoin.fetch_failed', identifier, err: error })
      }
    }))

    localLogger.info({
      event: 'oracle.plugin.kucoin.batch',
      requestedCount: uniqueIds.length,
      returnedCount: map.size,
    })

    return map
  }

  private async fetchTicker(
    symbol: string,
    timeoutMs: number,
    localLogger: ILogger,
  ): Promise<PriceFeedResult | null> {
    const url = new URL('/api/v1/market/orderbook/level1', this.baseUrl)
    url.searchParams.append('symbol', symbol)

    const payload = await fetchJson(url.toString(), timeoutMs)
    if (!isRecord(payload)) {
      localLogger.error({ event: 'oracle.plugin.kucoin.invalid_response', symbol, reason: 'payload is not a record' })
      return null
    }

    if (payload.code !== SUCCESS_CODE) {
      localLogger.error({ event: 'oracle.plugin.kucoin.invalid_response', symbol, code: payload.code })
      return null
    }

    const data = isRecord(payload.data) ? payload.data : null
    if (!data) {
      localLogger.error({ event: 'oracle.plugin.kucoin.invalid_response', symbol, reason: 'missing data' })
      return null
    }

    const price = data.price
    if (typeof price !== 'number' && typeof price !== 'string') {
      localLogger.error({ event: 'oracle.plugin.kucoin.invalid_response', symbol, reason: 'missing price' })
      return null
    }

    const time = data.time
    const publishTime = typeof time === 'number' ? Math.floor(time / 1000) : undefined

    return {
      price: typeof price === 'number' ? price.toString() : price,
      currency: this.currency,
      publishTime,
    }
  }
}
