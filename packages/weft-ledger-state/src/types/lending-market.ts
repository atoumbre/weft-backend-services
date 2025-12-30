import type Decimal from 'decimal.js'
import type { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'
import type { ConfigurationManager, OperatingStatusValue, ServiceManager } from './common'

export declare type MarketService
  = | 'CreateCDP'
    | 'UpdateCDP'
    | 'BurnCDP'

export declare type CollateralService
  = | 'Add'
    | 'Remove'
    | 'RemoveForLiquidation'
    | 'FlashOperation'

export declare type LoanService
  = | 'Borrow'
    | 'Repay'
    | 'RepayForRefinance'
    | 'RepayForLiquidation'
    | 'RepayForNFTLiquidation'

export declare type RegisteredResourceType
  = | { variantName: 'RegisteredToken' }
    | { variantName: 'LSU', value: string }
    | { variantName: 'DepositUnit', value: string }

export declare type RegisteredNFTResourceType
  = | { variantName: 'RegisteredNFT' }
    | { variantName: 'ClaimNFT', value: string }

export declare interface MarketConfig {
  maxCdpPosition: number
  priceExpirationPeriod: number
  defaultEfficiencyConfigId?: number | undefined
}

export declare interface MarketProtocolFeeConfig {
  protocolCdpCreationFee: Decimal
  protocolLiquidationBonusFeeRate: Decimal
}

export declare interface CacheEntry<T> {
  transactionHash: string
  cachedValue: T
  timestamp: string
}

export declare interface PriceFeed {
  description: string
  priceFeedType: string
}

export declare interface LoanConfig {
  description: string
  loanValueFactor: Decimal
  loanCloseFactor: Decimal
}

export declare interface CollateralConfig {
  description: string
  loanToValueRatio: Decimal
  liquidationThresholdSpread: Decimal
  liquidationBonusRate: Decimal
}
export declare interface IsolationGroup {
  description: string
}

export declare interface EfficiencyGroup {
  description: string
  collateralConfigId: number
}

export declare interface NFTCollateralConfig {
  /// External component called to get the redeemable value of the NFT
  /// in underlying asset(s)
  valuatorComponent: string

  /// Method name of the valuator component
  valuatorMethod: string

  /// Underlying resource from the NFT collateral accepted
  underlyingResources: string[]
}

export declare interface LoanResourceConfig {
  loanConfigId: number
  excludedIsolationGroupIds: number[]
  efficiencyGroupId: number | undefined
}

export declare interface CollateralResourceConfig {
  collateralConfigId: number
  isolationGroupId: number | undefined
  efficiencyGroupIds: number[]
}

export declare interface ResourceConfig {
  priceFeedId: number
  loanConfig?: LoanResourceConfig
  collateralConfig?: CollateralResourceConfig
}

export declare interface LendingPoolProxy {
  /// Attached lending pool component
  lendingPool: string

  /// Lending Market client badge required to have access to protected methods of the lending pool
  clientBadge: string

  /// Cache for loan unit ratio (Updated on every transaction)
  loanUnitRatioCache: KeyValueStore<string, CacheEntry<Decimal>>

  /// Cache for deposit unit ratio (Updated on every transaction)
  depositUnitRatioCache: KeyValueStore<string, CacheEntry<Decimal>>
}

export declare interface LendingMarketState {
  ///
  /// A proxy object to access LendingPool liquidity
  ///
  /// This component is a client of the lending pool component. it will make calls to the lending pool component
  /// Borrow and Repay methods will need to call protected_borrow and protected_repay methods of the lending pool.
  /// This object make it easy to do so.
  ///
  /// The Proxy will hold the badge required to call protected_borrow and protected_repay.
  /// The Proxy will also implement caching on deposit_unit_ratio loan_unit_ratio to reduce tx fees
  ///
  lendingPoolProxy: LendingPoolProxy

  /// CDP NFT resource manager
  cdpResManager: string

  ///
  /// Transient resource manager
  ///
  /// This component use transient token to manage controlled re-entrance required
  /// in the flash collateral remove and add operations.
  ///
  transientResManager: string

  /// Incremented each time there is a new CDP
  cdpCounter: number

  /// Market level global config
  config: MarketConfig

  // Protocol fee config
  feeConfig: MarketProtocolFeeConfig

  /// Market Services status
  marketServiceStatus: Record<MarketService, OperatingStatusValue>

  loanServiceManager: ServiceManager<string, LoanService>

  collateralServiceManager: ServiceManager<string, CollateralService>

  /// Config managers
  ///
  /// Price feeds manager
  priceFeedManager: ConfigurationManager<string, PriceFeed>

  /// Loan config manager
  loanConfigManager: ConfigurationManager<string, LoanConfig>

  /// Collateral config manager
  collateralConfigManager: ConfigurationManager<string, CollateralConfig>

  /// Isolation config manager
  isolationGroupManager: ConfigurationManager<string, IsolationGroup>

  /// Efficiency config manager
  efficiencyGroupManager: ConfigurationManager<string, EfficiencyGroup>

  /// Registered Fungible resource config
  resourceConfigs: KeyValueStore<string, ResourceConfig>

  /// NFT collateral resources register
  nftCollateralResourceConfigs: KeyValueStore<string, NFTCollateralConfig>

  /// Efficiency pairs register
  /// Store the config id for each configured efficiency pair
  efficiencyPairs: KeyValueStore<string, number>

  /// Price cache
  ///
  /// The price cache is used to reduce the number of external price feed component calls to reduce the tx fees.
  priceCache: KeyValueStore<string, CacheEntry<Decimal>>

  ///
  resourceTypeCache: KeyValueStore<string, RegisteredResourceType>

  ///
  nftResourceTypeCache: KeyValueStore<string, RegisteredNFTResourceType>

  ///
  collateralAssets: KeyValueStore<string, string>

  ///
  nftCollateralAssets: KeyValueStore<string, string>

  ///
  cdpCreationFees: string

  ///
  liquidationFees: KeyValueStore<string, string>

  ///
  nftLiquidationFees: string
}
