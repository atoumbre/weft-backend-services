import type { ILogger } from '@local-packages/common-utils'

export type { ILogger }

export type PriceCurrency = 'USD' | 'XRD'

export interface PriceFeedResult {
  price: string
  currency: PriceCurrency
  publishTime?: number
  metadata?: Record<string, unknown>
}

export interface PriceFeedPlugin {
  name: string
  currency: PriceCurrency

  fetchBatch: (
    identifiers: string[],
    options: PluginFetchOptions,
    localLogger: ILogger,
  ) => Promise<Map<string, PriceFeedResult>>

  isResultValid?: (result: PriceFeedResult, options: PluginFetchOptions) => boolean
}

export interface PluginFetchOptions {
  timeoutMs: number
  maxPriceAgeSec?: number
  [key: string]: unknown
}
