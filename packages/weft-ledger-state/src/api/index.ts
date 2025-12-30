import type { GatewayApiClient, LedgerStateSelector, StateNonFungibleLocationResponseItem } from '@radixdlt/babylon-gateway-api-sdk'
import type Decimal from 'decimal.js'
import type EntityStateFetcher from '../../../state-fetcher/src/state-fetcher'
import type { InterestStrategy } from '../models/interest-strategy'
import type { CollateralizeDebtPositionData } from '../types/cdp'
import type { OperatingStatusValue } from '../types/common'
import type { LoanService, MarketConfig, MarketProtocolFeeConfig, MarketService } from '../types/lending-market'
import type { LendingService } from '../types/lending-pool'
import type { CollateralResource, FetchResult, GlobalCollateralService, LoanResource, ReturnedResourcePoolState } from '../types/return-types'
import type { MarketResourceInfo } from './component-resource-operations'
import { WeftLedgerStateClient } from './base-client'
import { CdpOperations } from './cdp-operations'
import { ComponentResourceOperations } from './component-resource-operations'
import { MarketOperations } from './market-operations'
import { PoolOperations } from './pool-operations'
import { WeftStakingOperations } from './weft-staking'

export * from './base-client'
export * from './cdp-operations'
export * from './component-resource-operations'
export * from './market-operations'
export * from './pool-operations'
export * from './weft-staking'

export interface WeftRadixApiServiceInterface {
  getPrice: (resources: string[] | undefined, ledgerStateSelector?: LedgerStateSelector | undefined) => Promise<{ resourceAddress: string, price: Decimal }[]>

  getPoolInfos: (ledgerStateSelector?: LedgerStateSelector) => Promise<{
    pools: ReturnedResourcePoolState[]
    globalLendingService: Record<LendingService, OperatingStatusValue>
  }>

  getInterestModels: () => Promise<{ id: string, model: InterestStrategy }[]>

  getMarketInfos: (edgerStateSelector?: LedgerStateSelector) => Promise<{
    loanResources: LoanResource[]
    collateralResources: CollateralResource[]
    marketConfig: MarketConfig
    marketFeeConfig: MarketProtocolFeeConfig
    globalLendingService: Record<LendingService, OperatingStatusValue>
    globalMarketService: Record<MarketService, OperatingStatusValue>
    globalLoanService: Record<LoanService, OperatingStatusValue>
    globalCollateralService: GlobalCollateralService
  }>

  getResourceInfos: (componentAddresses: string[], ledgerStateSelector?: LedgerStateSelector) => Promise<Record<string, MarketResourceInfo>>

  getSingleCdp: (id: string, preManifest: string) => Promise<CollateralizeDebtPositionData>

  getMultipleCdp: (
    ids: string[],
    options?: { cdpPerBatch?: number, onProgress?: (fetched: number) => void },
  ) => Promise<FetchResult>

  // Extras

  getCdpIds: (returnBurntTokens: boolean) => Promise<StateNonFungibleLocationResponseItem[]>

  getWeftStakingApr: () => Promise<{ apr: number, staked: number, tvl_xrd: number, tvl_usd: number }>
}

export class WeftLedgerSateFetcher implements WeftRadixApiServiceInterface {
  private client: WeftLedgerStateClient
  private poolOps: PoolOperations
  private marketOps: MarketOperations
  private cdpOps: CdpOperations
  private stakingOps: WeftStakingOperations
  private resourceOps: ComponentResourceOperations

  private constructor(client: WeftLedgerStateClient) {
    this.client = client
    this.poolOps = new PoolOperations(client)
    this.marketOps = new MarketOperations(client, this.poolOps)
    this.cdpOps = new CdpOperations(client)
    this.stakingOps = new WeftStakingOperations(client, this.marketOps, this.poolOps)
    this.resourceOps = new ComponentResourceOperations(client)
  }

  private static instance: WeftLedgerSateFetcher

  static setInstance(radixGatewayApi?: GatewayApiClient): WeftLedgerSateFetcher {
    if (!this.instance) {
      const client = WeftLedgerStateClient.setInstance(radixGatewayApi)
      this.instance = new WeftLedgerSateFetcher(client)
    }

    return this.instance
  }

  static getInstance(): WeftLedgerSateFetcher {
    if (!this.instance) {
      throw new Error('WeftRadixApiService not instantiated')
    }

    return this.instance
  }

  getFetcher(): EntityStateFetcher {
    return this.client.getFetcher()
  }

  getGatewayApi(): GatewayApiClient {
    return this.client.getGatewayApi()
  }

  // Pool Operations
  async getPoolInfos(ledgerStateSelector?: LedgerStateSelector): Promise<{
    pools: ReturnedResourcePoolState[]
    globalLendingService: Record<LendingService, OperatingStatusValue>
  }> {
    return this.poolOps.getPoolInfos(ledgerStateSelector)
  }

  // Market Operations
  async getMarketInfos(ledgerStateSelector?: LedgerStateSelector): Promise<{
    loanResources: LoanResource[]
    collateralResources: CollateralResource[]
    marketConfig: MarketConfig
    marketFeeConfig: MarketProtocolFeeConfig
    globalMarketService: Record<MarketService, OperatingStatusValue>
    globalLendingService: Record<LendingService, OperatingStatusValue>
    globalLoanService: Record<LoanService, OperatingStatusValue>
    globalCollateralService: GlobalCollateralService
  }> {
    return this.marketOps.getMarketInfos(ledgerStateSelector)
  }

  async getPrice(resources?: string[], ledgerStateSelector?: LedgerStateSelector): Promise<{ resourceAddress: string, price: Decimal }[]> {
    return this.marketOps.getPrice(resources, ledgerStateSelector)
  }

  async getInterestModels(ledgerStateSelector?: LedgerStateSelector): Promise<{ id: string, model: InterestStrategy }[]> {
    return this.marketOps.getInterestModels(ledgerStateSelector)
  }

  // Resource ops
  async getResourceInfos(componentAddresses: string[], ledgerStateSelector?: LedgerStateSelector): Promise<Record<string, MarketResourceInfo>> {
    return this.resourceOps.getResourceInfos(componentAddresses, ledgerStateSelector)
  }

  // CDP Operations
  async getMultipleCdp(ids: string[], options?: { cdpPerBatch?: number, onProgress?: (fetched: number) => void }): Promise<FetchResult> {
    return this.cdpOps.getMultipleCdp(ids, options)
  }

  async getSingleCdp(id: string, preManifest: string): Promise<CollateralizeDebtPositionData> {
    return this.cdpOps.getSingleCdp(id, preManifest)
  }

  async getCdpIds(returnBurntTokens: boolean = false): Promise<StateNonFungibleLocationResponseItem[]> {
    return this.cdpOps.getCdpIds(returnBurntTokens)
  }

  // Weft Staking Operations
  async getWeftStakingApr(): Promise<{ apr: number, staked: number, tvl_xrd: number, tvl_usd: number }> {
    return this.stakingOps.getWeftStakingApr()
  }
}
