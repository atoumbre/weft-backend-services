import type Decimal from 'decimal.js'
import type { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'
import type { InterestStrategy } from '../models/interest-strategy'
import type { ConfigurationManager, ServiceManager } from './common'

export declare type LendingService
  = | 'FlashLoan'
    | 'Deposit'
    | 'Withdraw'
    | 'ProtectedBorrow'
    | 'ProtectedRepay'

export declare type DepositLimitType
  = | { variantName: 'None' }
    | { variantName: 'Amount', value: Decimal }
    | { variantName: 'SupplyRatio', value: Decimal }

export declare interface LendingPoolProtocolFeeConfig {
  protocolLoanFeeRate: number
  protocolFlashLoanFeeRate: number
  protocolInterestFeeRate: number
}

export declare interface ContributionState {
  divisibility: number
  total: Decimal
  totalUnits: Decimal
  unitRatio: Decimal
}

export declare interface ResourcePoolConfig {
  interestUpdatePeriod: number
  loanFeeRate: Decimal
  flashLoanFeeRate: Decimal
  depositLimit: DepositLimitType
  utilizationLimit: Decimal | undefined
  flashLoanAmountLimit: DepositLimitType
}

export declare interface ResourcePoolState {
  liquidity: string
  depositUnitResAddress: string
  interestRate: number
  interestUpdatedAt: number
  pendingProtocolFeeAmount: Decimal
  depositState: ContributionState
  loanState: ContributionState
  interestStrategyId: number
  poolConfig: ResourcePoolConfig
}

export declare interface LendingPoolState {
  lendingServiceManager: ServiceManager<string, LendingService>
  transientResManager: string
  resourcePools: KeyValueStore<string, ResourcePoolState>
  depositUnitLookup: KeyValueStore<string, any>
  feeConfig: LendingPoolProtocolFeeConfig
  interestStrategyManager: ConfigurationManager<string, InterestStrategy>
  internalAuthBadge: string
  clientBadgeActivationDelay: number
  clientBadgeResManager: string
  clientBadges: string
}
