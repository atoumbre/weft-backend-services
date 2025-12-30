// import type { LedgerStateSelector, TransactionPreviewResponse } from '@radixdlt/babylon-gateway-api-sdk'
// import type Decimal from 'decimal.js'
// import type { ConfigurationEntry, OperatingStatusValue } from '../types/common'
// import type { CollateralConfig, CollateralResourceConfig, CollateralService, EfficiencyGroup, LendingMarketState, LoanConfig, LoanResourceConfig, LoanService, MarketConfig, MarketProtocolFeeConfig, MarketService, ResourceConfig } from '../types/lending-market'
// import type { LendingPoolState, LendingService } from '../types/lending-pool'
// import type { ClaimNFT, GlobalCollateralService, LSUResource, ReturnedResourcePoolState } from '../types/return-types'
// import type { WeftLedgerStateClient } from './base-client'
// import type { PoolOperations } from './pool-operations'
// import { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'
// import { dec, ZERO } from '../../../state-fetcher/src/utils'
// import { defaultLendingPools, LENDING_MARKET_COLLATERAL_CONFIG_KVS, LENDING_MARKET_COLLATERAL_SERVICE_KVS, LENDING_MARKET_COMPONENT, LENDING_MARKET_EFFICIENT_GROUP_KVS, LENDING_MARKET_LOAN_CONFIG_KVS, LENDING_MARKET_LOAN_SERVICE_KVS, LENDING_MARKET_PRICE_CACHE_KVS, LENDING_MARKET_RES_CONFIG_KVS, LENDING_POOL_COMPONENT, LENDING_POOL_INTEREST_STRATEGY_KVS } from '../lib/const'
// import { createBaseTransactionParams } from '../lib/transaction-utils'
// import { InterestStrategy } from '../models/interest-strategy'

// export interface LoanResource {
//   resourceAddress: string
//   resourceConfig: LoanResourceConfig
//   riskConfig: LoanConfig
//   services: Record<LoanService, OperatingStatusValue>
//   lendingPoolState?: ReturnedResourcePoolState
//   metadata: Record<string, string>
//   duMetadata: Record<string, string>
// }

// export interface CollateralResource {
//   resourceAddress: string
//   resourceConfig: CollateralResourceConfig
//   riskConfig: CollateralConfig
//   services: Record<CollateralService, OperatingStatusValue>
//   efficiencyConfigs: Record<string, { group: EfficiencyGroup, config: CollateralConfig }>
//   totalDeposit: Decimal
//   totalDepositDU: Decimal
//   totalDepositUnderDU: Decimal
//   metadata: Record<string, string>
// }

// export class MarketOperations {
//   constructor(
//     private client: WeftLedgerStateClient,
//     private poolOps: PoolOperations,
//   ) {}

//   async getMarketInfos(ledgerStateSelector?: LedgerStateSelector): Promise<{
//     loanResources: LoanResource[]
//     collateralResources: CollateralResource[]
//     // lsuCollaterals: LSUResource[]
//     // claimNftCollaterals: ClaimNFT[]
//     marketConfig: MarketConfig
//     marketFeeConfig: MarketProtocolFeeConfig
//     globalMarketService: Record<MarketService, OperatingStatusValue>
//     globalLendingService: Record<LendingService, OperatingStatusValue>
//     globalLoanService: Record<LoanService, OperatingStatusValue>
//     globalCollateralService: GlobalCollateralService

//     allFungibleResourceAddresses: string[]
//     allValidatorAddresses: string[]
//   }> {
//     const allFungibleResourceAddressesSet = new Set<string>()
//     const allValidatorAddressesSet = new Set<string>()

//     const resourceConfigs = new KeyValueStore<string, ResourceConfig>(LENDING_MARKET_RES_CONFIG_KVS, this.client.getFetcher())
//     const collateralConfigManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, CollateralConfig>>(LENDING_MARKET_COLLATERAL_CONFIG_KVS, this.client.getFetcher())
//     const loanConfigManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, LoanConfig>>(LENDING_MARKET_LOAN_CONFIG_KVS, this.client.getFetcher())
//     const efficiencyGroupManagerEntries = new KeyValueStore<string, ConfigurationEntry<string, EfficiencyGroup>>(LENDING_MARKET_EFFICIENT_GROUP_KVS, this.client.getFetcher())
//     const loanServiceManagerEntries = new KeyValueStore<string, Record<LoanService, OperatingStatusValue>>(LENDING_MARKET_LOAN_SERVICE_KVS, this.client.getFetcher())
//     const collateralServiceManagerEntries = new KeyValueStore<string, Record<CollateralService, OperatingStatusValue>>(LENDING_MARKET_COLLATERAL_SERVICE_KVS, this.client.getFetcher())

//     const [lendingInfo, lendingPoolComponentStates, lendingMarketComponentStates] = await Promise.all([
//       this.poolOps.getPoolInfos(ledgerStateSelector),
//       this.client.getFetcher().fetchEntityState<LendingPoolState>([LENDING_POOL_COMPONENT], {
//         ledgerStateSelector,
//         loadResourceDetails: true,
//       }),
//       this.client.getFetcher().fetchEntityState<LendingMarketState>([LENDING_MARKET_COMPONENT], {
//         ledgerStateSelector,
//         loadResourceDetails: true,
//       }),
//       resourceConfigs.init(ledgerStateSelector),
//       collateralConfigManagerEntries.init(ledgerStateSelector),
//       loanConfigManagerEntries.init(ledgerStateSelector),
//       efficiencyGroupManagerEntries.init(ledgerStateSelector),
//       loanServiceManagerEntries.init(ledgerStateSelector),
//       collateralServiceManagerEntries.init(ledgerStateSelector),
//     ])

//     const lendingPoolComponentState = lendingPoolComponentStates[0]
//     const lendingMarketComponentState = lendingMarketComponentStates[0]

//     if (!lendingMarketComponentState)
//       throw new Error('Invalid State')

//     const marketState = lendingMarketComponentState.$state

//     if (!marketState)
//       throw new Error('Invalid State')

//     const loanResources: LoanResource[] = []
//     const collateralResources: CollateralResource[] = []

//     Object.entries(resourceConfigs.values).forEach(([address, config]) => {
//       allFungibleResourceAddressesSet.add(address)

//       if (config.loanConfig) {
//         const lendingPoolState = lendingInfo.pools.find(pool => pool.resourceAddress === address)!
//         const resourceDetails = lendingPoolComponentState?.$fungibleResources.values[address]?.fungibleDetails
//         const duResourceDetails = lendingMarketComponentState?.$fungibleResources.values[lendingPoolState.depositUnitAddress]?.fungibleDetails

//         loanResources.push({
//           resourceAddress: address,
//           resourceConfig: config.loanConfig,
//           riskConfig: loanConfigManagerEntries.getValue(`Current_${config.loanConfig.loanConfigId}`)!.entry,
//           services: loanServiceManagerEntries.getValue(`Resource_${address}`)!,
//           lendingPoolState,
//           metadata: resourceDetails?.$metadata ?? {},
//           duMetadata: duResourceDetails?.$metadata ?? {},
//         })
//       }

//       if (config.collateralConfig) {
//         const efficiencyConfigs: Record<string, { group: EfficiencyGroup, config: CollateralConfig }> = {}

//         config.collateralConfig.efficiencyGroupIds.forEach((p) => {
//           const efficiencyConfig = efficiencyGroupManagerEntries.getValue(`Current_${p}`)!.entry
//           efficiencyConfigs[`${p}`] = { group: efficiencyConfig, config: collateralConfigManagerEntries.getValue(`Current_${efficiencyConfig.collateralConfigId}`)!.entry }
//         })

//         collateralResources.push({
//           resourceAddress: address,
//           resourceConfig: config.collateralConfig,
//           riskConfig: collateralConfigManagerEntries.getValue(`Current_${config.collateralConfig.collateralConfigId}`)!.entry,
//           efficiencyConfigs,
//           services: collateralServiceManagerEntries.getValue(`Resource_${address}`)!,
//           totalDeposit: dec(0),
//           totalDepositDU: dec(0),
//           totalDepositUnderDU: dec(0),
//           metadata: {},
//         })
//       }
//     })

//     const lsuCollaterals: LSUResource[] = []

//     Object.entries(lendingMarketComponentState?.$fungibleResources.values ?? {}).forEach(([address, data]) => {
//       allFungibleResourceAddressesSet.add(address)

//       const duIndex = loanResources.findIndex(loanResource => loanResource.lendingPoolState?.depositUnitAddress === address)

//       const collateralAddress = duIndex > -1
//         ? loanResources[duIndex]!.resourceAddress
//         : address

//       const index = collateralResources.findIndex(collateralResource =>
//         collateralResource.resourceAddress === collateralAddress,
//       )

//       if (index > -1) {
//         if (duIndex > -1) {
//           const duAmount = collateralResources[index]!.totalDeposit.add(data.amount ?? dec(0))
//           collateralResources[index]!.totalDepositDU = duAmount
//           collateralResources[index]!.totalDepositUnderDU = dec(duAmount.mul(loanResources[duIndex]!.lendingPoolState!.depositUnitPrice))
//         }
//         else {
//           collateralResources[index]!.totalDeposit = collateralResources[index]!.totalDeposit.add(data.amount ?? dec(0))

//           collateralResources[index]!.metadata = data.fungibleDetails?.$metadata ?? {}
//         }
//       }
//       else {
//         // LSU

//         if (!data.amount.eq(ZERO)) {
//           if (data.fungibleDetails?.$details.native_resource_details?.kind === 'ValidatorLiquidStakeUnit' && !data.amount.eq(ZERO)) {
//             const lsu: LSUResource = {
//               resourceAddress: address,
//               amount: data.amount,
//               unitRedemptionValue: dec(data.fungibleDetails?.$details.native_resource_details?.unit_redemption_value[0]?.amount ?? '0'),
//               validatorAddress: data.fungibleDetails?.$details.native_resource_details?.validator_address,
//               metadata: data.fungibleDetails?.$metadata,
//               validatorMetadata: {},
//             }

//             lsuCollaterals.push(lsu)
//             allValidatorAddressesSet.add(lsu?.validatorAddress)
//           }
//         }
//       }
//     })

//     const claimNftCollaterals: ClaimNFT[] = []

//     Object.entries(lendingMarketComponentState?.$nonFungibleResources.values ?? {}).forEach(([address, data]) => {
//       const ids = data.ids ?? []

//       if (ids.length === 0) {
//         return
//       }

//       if (data.nonFungibleDetails?.$details.native_resource_details?.kind === 'ValidatorClaimNft') {
//         const claimNft: ClaimNFT = {
//           resourceAddress: address,
//           ids,
//           validatorAddress: data.nonFungibleDetails?.$details.native_resource_details?.validator_address,
//           metadata: data.nonFungibleDetails?.$metadata,
//           validatorMetadata: {},
//         }

//         claimNftCollaterals.push(claimNft)
//         allValidatorAddressesSet.add(claimNft?.validatorAddress)
//       }
//     })

//     const resourceWithoutDetails = collateralResources.filter(resource => Object.keys(resource.metadata).length === 0).map(resource => resource.resourceAddress)

//     const res = await Promise.all([
//       this.client.getFetcher().fetchResourceState(resourceWithoutDetails),
//       this.client.getFetcher().fetchEntityState([...allValidatorAddressesSet], {
//         loadState: true,
//         loadResourceDetails: false,
//         recursiveFungibleResourceLoading: false,
//         recursiveNonFungibleResourceLoading: false,
//       }),
//     ])

//     res[0].forEach((res) => {
//       if (res.$type === 'FungibleResource') {
//         const index = collateralResources.findIndex(collateralResource =>
//           collateralResource.resourceAddress === res.$entityAddress,
//         )

//         collateralResources[index]!.metadata = res.$metadata
//       }
//     })

//     res[1].forEach((state) => {
//       const lsuIndex = lsuCollaterals.findIndex(l => l.validatorAddress === state.$entityAddress)

//       if (lsuIndex > -1) {
//         lsuCollaterals[lsuIndex]!.validatorMetadata = state.$metadata
//       }

//       const claimNftIndex = claimNftCollaterals.findIndex(l => l.validatorAddress === state.$entityAddress)

//       if (claimNftIndex > -1) {
//         claimNftCollaterals[claimNftIndex]!.validatorMetadata = state.$metadata
//       }
//     })

//     const globalMarketService = marketState.marketServiceStatus
//     const globalLendingService = lendingInfo.globalLendingService
//     const globalLoanService = loanServiceManagerEntries.getValue(`Global`)!
//     const globalCollateralService: GlobalCollateralService = {
//       resource: collateralServiceManagerEntries.getValue(`GlobalResource`)!,
//       lsu: collateralServiceManagerEntries.getValue(`GlobalNFT`)!,
//       nft: collateralServiceManagerEntries.getValue(`GlobalClaimNFT`)!,
//       claimNft: collateralServiceManagerEntries.getValue(`GlobalLSU`)!,
//     }

//     const marketConfig: MarketConfig = marketState!.config
//     const marketFeeConfig: MarketProtocolFeeConfig = marketState!.feeConfig

//     return {
//       marketConfig,
//       marketFeeConfig,
//       loanResources,
//       collateralResources,
//       globalMarketService,
//       globalLendingService,
//       globalLoanService,
//       globalCollateralService,
//       lsuCollaterals,
//       claimNftCollaterals,

//       allFungibleResourceAddresses: [...allFungibleResourceAddressesSet],
//       allValidatorAddresses: [...allValidatorAddressesSet],
//     }
//   }

//   async getPrice(resources: string[] | undefined = defaultLendingPools, resourcesPerBatch: number = 10): Promise<{ resourceAddress: string, price: Decimal }[]> {
//     const batchedResources: string[][] = []

//     for (let i = 0; i < resources.length; i += resourcesPerBatch) {
//       batchedResources.push(resources.slice(i, i + resourcesPerBatch).map(resource => `Address("${resource}")`))
//     }

//     const prices: { resourceAddress: string, price: Decimal }[] = []

//     const manifests = batchedResources.map(
//       batchedResource => `CALL_METHOD Address("${LENDING_MARKET_COMPONENT}") "get_price" Array<Address>(${batchedResource.join(',')});

// `,
//     )

//     const response: TransactionPreviewResponse[] = await Promise.all(manifests.map(manifest =>
//       this.client.getGatewayApi().transaction.innerClient.transactionPreview({
//         transactionPreviewRequest: { ...createBaseTransactionParams(), manifest },
//       }),
//     ))

//     const receipts = response
//       .map((r) => {
//         if ((r.receipt as any).status !== 'Succeeded') {
//           throw new Error((r.receipt as any).error_message)
//         }

//         return (r.receipt as any).output[0].programmatic_json.entries
//       })
//       .flat()

//     receipts.forEach((r) => {
//       prices.push({
//         resourceAddress: r.key.value,
//         price: dec(r.value.value),
//       })
//     })

//     return prices
//   }

//   async getPriceAtLedgerState(resources: string[], ledgerStateSelector?: LedgerStateSelector): Promise<{ resourceAddress: any, price: Decimal }[]> {
//     const kvs = new KeyValueStore<string, { cachedValue: Decimal, timestamp: number }>(LENDING_MARKET_PRICE_CACHE_KVS, this.client.getFetcher())

//     await kvs.init(ledgerStateSelector)

//     const price = resources.reduce((acc, resource) => {
//       const cachedValue = kvs.getValue(resource)
//       if (cachedValue) {
//         acc.push({ resourceAddress: resource, price: cachedValue.cachedValue })
//       }
//       return acc
//     }, [] as { resourceAddress: any, price: Decimal }[])

//     return price
//   }

//   async getInterestModels(ledgerStateSelector?: LedgerStateSelector): Promise<{ id: string, model: InterestStrategy }[]> {
//     const kvs = new KeyValueStore<string, any>(LENDING_POOL_INTEREST_STRATEGY_KVS, this.client.getFetcher())
//     await kvs.init(ledgerStateSelector)

//     const models = Object.entries(kvs.values).map(([key, value]) => ({
//       id: key.replace('Current_', ''),
//       model: new InterestStrategy(value.entry.breakPoints ?? [], value.entry.description),
//     }))

//     return models
//   }
// }
