import type { LedgerStateSelector, TransactionPreviewResponse } from '@radixdlt/babylon-gateway-api-sdk'
import type Decimal from 'decimal.js'
import type { ConfigurationEntry, OperatingStatusValue } from '../types/common'
import type { CollateralConfig, CollateralService, EfficiencyGroup, LendingMarketState, LoanConfig, LoanService, MarketConfig, MarketProtocolFeeConfig, MarketService, ResourceConfig } from '../types/lending-market'
import type { LendingService } from '../types/lending-pool'
import type { CollateralResource, GlobalCollateralService, LoanResource } from '../types/return-types'
import type { WeftLedgerStateClient } from './base-client'
import type { PoolOperations } from './pool-operations'
import { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'
import { dec } from '../../../state-fetcher/src/utils'
import { defaultLendingPools, LENDING_MARKET_COLLATERAL_CONFIG_KVS, LENDING_MARKET_COLLATERAL_SERVICE_KVS, LENDING_MARKET_COMPONENT, LENDING_MARKET_EFFICIENT_GROUP_KVS, LENDING_MARKET_LOAN_CONFIG_KVS, LENDING_MARKET_LOAN_SERVICE_KVS, LENDING_MARKET_PRICE_CACHE_KVS, LENDING_MARKET_RES_CONFIG_KVS, LENDING_POOL_INTEREST_STRATEGY_KVS } from '../lib/const'
import { createBaseTransactionParams } from '../lib/transaction-utils'
import { InterestStrategy } from '../models/interest-strategy'

export class MarketOperations {
  constructor(
    private client: WeftLedgerStateClient,
    private poolOps: PoolOperations,
  ) {}

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
    const resourceConfigs = new KeyValueStore<string, ResourceConfig>(LENDING_MARKET_RES_CONFIG_KVS, this.client.getFetcher())
    const collateralConfigManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, CollateralConfig>>(LENDING_MARKET_COLLATERAL_CONFIG_KVS, this.client.getFetcher())
    const loanConfigManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, LoanConfig>>(LENDING_MARKET_LOAN_CONFIG_KVS, this.client.getFetcher())
    const efficiencyGroupManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, EfficiencyGroup>>(LENDING_MARKET_EFFICIENT_GROUP_KVS, this.client.getFetcher())
    const loanServiceManagerEntries = new KeyValueStore<string, Record<LoanService, OperatingStatusValue>>(LENDING_MARKET_LOAN_SERVICE_KVS, this.client.getFetcher())
    const collateralServiceManagerEntries = new KeyValueStore<string, Record<CollateralService, OperatingStatusValue>>(LENDING_MARKET_COLLATERAL_SERVICE_KVS, this.client.getFetcher())

    const [lendingInfo, lendingMarketComponentStates] = await Promise.all([
      this.poolOps.getPoolInfos(ledgerStateSelector),
      this.client.getFetcher().fetchEntityState<LendingMarketState>([LENDING_MARKET_COMPONENT], { ledgerStateSelector }),
      resourceConfigs.init(ledgerStateSelector),
      collateralConfigManagerEntries.init(ledgerStateSelector),
      loanConfigManagerEntries.init(ledgerStateSelector),
      efficiencyGroupManagerEntries.init(ledgerStateSelector),
      loanServiceManagerEntries.init(ledgerStateSelector),
      collateralServiceManagerEntries.init(ledgerStateSelector),
    ])

    const lendingMarketComponentState = lendingMarketComponentStates[0]

    if (!lendingMarketComponentState)
      throw new Error('Invalid State')

    const marketState = lendingMarketComponentState.$state

    if (!marketState)
      throw new Error('Invalid State')

    const loanResources: LoanResource[] = []
    const collateralResources: CollateralResource[] = []

    Object.entries(resourceConfigs.values).forEach(([address, config]) => {
      if (config.loanConfig) {
        const lendingPoolState = lendingInfo.pools.find(pool => pool.resourceAddress === address)!

        loanResources.push({
          resourceAddress: address,
          resourceConfig: config.loanConfig,
          riskConfig: loanConfigManagerEntries.getValue(`Current_${config.loanConfig.loanConfigId}`)!.entry,
          services: loanServiceManagerEntries.getValue(`Resource_${address}`)!,
          lendingPoolState,
        })
      }

      if (config.collateralConfig) {
        const efficiencyConfigs: Record<string, { group: EfficiencyGroup, config: CollateralConfig }> = {}

        config.collateralConfig.efficiencyGroupIds.forEach((p) => {
          const efficiencyConfig = efficiencyGroupManagerEntries.getValue(`Current_${p}`)!.entry
          efficiencyConfigs[`${p}`] = { group: efficiencyConfig, config: collateralConfigManagerEntries.getValue(`Current_${efficiencyConfig.collateralConfigId}`)!.entry }
        })

        collateralResources.push({
          resourceAddress: address,
          resourceConfig: config.collateralConfig,
          riskConfig: collateralConfigManagerEntries.getValue(`Current_${config.collateralConfig.collateralConfigId}`)!.entry,
          services: collateralServiceManagerEntries.getValue(`Resource_${address}`)!,
          efficiencyConfigs,
        })
      }
    })

    const globalMarketService = marketState.marketServiceStatus
    const globalLendingService = lendingInfo.globalLendingService
    const globalLoanService = loanServiceManagerEntries.getValue(`Global`)!
    const globalCollateralService: GlobalCollateralService = {
      resource: collateralServiceManagerEntries.getValue(`GlobalResource`)!,
      lsu: collateralServiceManagerEntries.getValue(`GlobalNFT`)!,
      nft: collateralServiceManagerEntries.getValue(`GlobalClaimNFT`)!,
      claimNft: collateralServiceManagerEntries.getValue(`GlobalLSU`)!,
    }

    const marketConfig: MarketConfig = marketState!.config
    const marketFeeConfig: MarketProtocolFeeConfig = marketState!.feeConfig

    return {
      marketConfig,
      marketFeeConfig,
      loanResources,
      collateralResources,
      globalMarketService,
      globalLendingService,
      globalLoanService,
      globalCollateralService,
    }
  }

  async getPrice(resources: string[] | undefined = defaultLendingPools, ledgerStateSelector?: LedgerStateSelector): Promise<{ resourceAddress: string, price: Decimal }[]> {
    if (ledgerStateSelector)
      return this.getPriceAtLedgerState(resources, ledgerStateSelector)
    else
      return this.getPriceLive(resources)
  }

  private async getPriceAtLedgerState(resources: string[] | undefined = defaultLendingPools, ledgerStateSelector?: LedgerStateSelector): Promise<{ resourceAddress: any, price: Decimal }[]> {
    const kvs = new KeyValueStore<string, { cachedValue: Decimal, timestamp: number }>(LENDING_MARKET_PRICE_CACHE_KVS, this.client.getFetcher())

    await kvs.init(ledgerStateSelector)

    const price = resources.reduce((acc, resource) => {
      const cachedValue = kvs.getValue(resource)
      if (cachedValue) {
        acc.push({ resourceAddress: resource, price: cachedValue.cachedValue })
      }
      return acc
    }, [] as { resourceAddress: any, price: Decimal }[])

    return price
  }

  private async getPriceLive(resources: string[] | undefined = defaultLendingPools, resourcesPerBatch: number = 10): Promise<{ resourceAddress: string, price: Decimal }[]> {
    const batchedResources: string[][] = []

    for (let i = 0; i < resources.length; i += resourcesPerBatch) {
      batchedResources.push(resources.slice(i, i + resourcesPerBatch).map(resource => `Address("${resource}")`))
    }

    const prices: { resourceAddress: string, price: Decimal }[] = []

    const manifests = batchedResources.map(
      batchedResource => `CALL_METHOD Address("${LENDING_MARKET_COMPONENT}") "get_price" Array<Address>(${batchedResource.join(',')});

`,
    )

    const response: TransactionPreviewResponse[] = await Promise.all(manifests.map(manifest =>
      this.client.getGatewayApi().transaction.innerClient.transactionPreview({
        transactionPreviewRequest: { ...createBaseTransactionParams(), manifest },
      }),
    ))

    const receipts = response
      .map((r) => {
        if ((r.receipt as any).status !== 'Succeeded') {
          throw new Error((r.receipt as any).error_message)
        }

        return (r.receipt as any).output[0].programmatic_json.entries
      })
      .flat()

    receipts.forEach((r) => {
      prices.push({
        resourceAddress: r.key.value,
        price: dec(r.value.value),
      })
    })

    return prices
  }

  async getInterestModels(ledgerStateSelector?: LedgerStateSelector): Promise<{ id: string, model: InterestStrategy }[]> {
    const kvs = new KeyValueStore<string, any>(LENDING_POOL_INTEREST_STRATEGY_KVS, this.client.getFetcher())
    await kvs.init(ledgerStateSelector)

    const models = Object.entries(kvs.values).map(([key, value]) => ({
      id: key.replace('Current_', ''),
      model: new InterestStrategy(value.entry.breakPoints ?? [], value.entry.description),
    }))

    return models
  }
}
