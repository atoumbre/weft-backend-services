import type { ILogger, PluginFetchOptions, PriceCurrency, PriceFeedPlugin, PriceFeedResult } from './types'

import { fetchJson, isRecord } from '../utils'

export class GateioPlugin implements PriceFeedPlugin {
  name = 'gateio'
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
        localLogger.error({ event: 'oracle.plugin.gateio.fetch_failed', identifier, err: error })
      }
    }))

    localLogger.info({
      event: 'oracle.plugin.gateio.batch',
      requestedCount: uniqueIds.length,
      returnedCount: map.size,
    })

    return map
  }

  private async fetchTicker(
    currencyPair: string,
    timeoutMs: number,
    localLogger: ILogger,
  ): Promise<PriceFeedResult | null> {
    const url = new URL('/api/v4/spot/tickers', this.baseUrl)
    url.searchParams.append('currency_pair', currencyPair)

    const payload = await fetchJson(url.toString(), timeoutMs)
    const tickers = Array.isArray(payload) ? payload : []
    const ticker = tickers.find(entry => isRecord(entry) && entry.currency_pair === currencyPair)
      ?? (tickers.length === 1 && isRecord(tickers[0]) ? tickers[0] : null)

    if (!ticker) {
      localLogger.error({ event: 'oracle.plugin.gateio.invalid_response', currencyPair, reason: 'missing ticker' })
      return null
    }

    const last = ticker.last
    if (typeof last !== 'number' && typeof last !== 'string') {
      localLogger.error({ event: 'oracle.plugin.gateio.invalid_response', currencyPair, reason: 'missing last' })
      return null
    }

    const price = typeof last === 'number' ? last.toString() : last
    if (price.trim() === '') {
      localLogger.error({ event: 'oracle.plugin.gateio.invalid_response', currencyPair, reason: 'empty last' })
      return null
    }

    return {
      price,
      currency: this.currency,
    }
  }
}
