import type Decimal from 'decimal.js'
import type { CollateralizeDebtPositionData } from './cdp'
import type { OperatingStatusValue } from './common'
import type { CollateralConfig, CollateralResourceConfig, CollateralService, EfficiencyGroup, LoanConfig, LoanResourceConfig, LoanService } from './lending-market'
import type { LendingService, ResourcePoolConfig } from './lending-pool'

export interface ReturnedResourcePoolState {
  resourceAddress: string
  depositUnitAddress: string
  totalDeposit: Decimal
  totalLoan: Decimal
  utilizationRate: Decimal
  borrowingApr: Decimal
  rawLendingApr: Decimal
  netLendingApr: Decimal
  depositUnitRatio: Decimal
  depositUnitPrice: Decimal
  loanUnitRatio: Decimal
  loanUnitPrice: Decimal
  interestModelId: string
  config: ResourcePoolConfig
  serviceStatus?: Record<LendingService, OperatingStatusValue>
}

export interface FetchResult {
  data: CollateralizeDebtPositionData[]
  failedIds: string[]
  callCount?: number
}

export interface GlobalCollateralService {
  resource: Record<CollateralService, OperatingStatusValue>
  lsu: Record<CollateralService, OperatingStatusValue>
  nft: Record<CollateralService, OperatingStatusValue>
  claimNft: Record<CollateralService, OperatingStatusValue>
}

export interface LoanResource {
  resourceAddress: string
  resourceConfig: LoanResourceConfig
  riskConfig: LoanConfig
  services: Record<LoanService, OperatingStatusValue>
  lendingPoolState?: ReturnedResourcePoolState
}

export interface CollateralResource {
  resourceAddress: string
  resourceConfig: CollateralResourceConfig
  riskConfig: CollateralConfig
  services: Record<CollateralService, OperatingStatusValue>
  efficiencyConfigs: Record<string, { group: EfficiencyGroup, config: CollateralConfig }>
}

export interface FungibleResource {
  resourceAddress: string
  amount: Decimal
  metadata: Record<string, string>
  duAddress?: string
  duReverseAddress?: string
}

export interface LSUResource {
  resourceAddress: string
  amount: Decimal
  unitRedemptionValue: Decimal
  validatorAddress: string
  metadata: Record<string, string>
  validatorMetadata: Record<string, string>
}

export interface NonFungibleResource {
  resourceAddress: string
  ids: string[]
  metadata: Record<string, string>
}

export interface ClaimNFT {
  resourceAddress: string
  ids: string[]
  // ids: { id: string, data: object | undefined }[]
  validatorAddress: string
  metadata: Record<string, string>
  validatorMetadata: Record<string, string>
}
