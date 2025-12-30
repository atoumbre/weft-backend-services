import type Decimal from 'decimal.js'

import type { CollateralConfig, CollateralResourceConfig, LoanConfig, LoanResourceConfig, RegisteredNFTResourceType, RegisteredResourceType } from './lending-market'

interface EfficiencyMode { variantId: string, efficiencyGroupId: number | undefined }

interface CollateralConfigVersion {
  entryVersion: number
  efficiencyMode: EfficiencyMode
}

export interface CollateralPositionData {
  price: Decimal
  amount: Decimal
  value: Decimal
  healthValue: Decimal
  liquidationValue: Decimal
  discountedValue: Decimal
  config: CollateralConfig
  configVersion: CollateralConfigVersion
  resourceConfig: CollateralResourceConfig
  isFromNft: boolean
  resourceType: RegisteredResourceType
}

export interface LoanPositionData {
  price: Decimal
  units: Decimal
  amount: Decimal
  value: Decimal
  adjustedValue: Decimal
  config: LoanConfig
  configVersion: number
  resourceConfig: LoanResourceConfig
}

export interface NFTLiquidationValue {
  value: Decimal
  discountedValue: Decimal
  loanPaymentValue: Decimal
  compensationValue: Decimal
  liquidationFee: Decimal
  resourceType: RegisteredNFTResourceType
}

export interface NFTCollateralPositionData {
  underlyingPositions: Record<string, CollateralPositionData>
  value: NFTLiquidationValue
  maxAllowedDiscountedValue: Decimal
}

export interface CollateralizeDebtPositionData {

  id: string

  totalLoanValue: Decimal
  totalAdjustedLoanValue: Decimal

  totalCollateralValue: Decimal
  totalHealthCollateralValue: Decimal
  totalLiquidationCollateralValue: Decimal

  collateralIsolationGroups: number[]
  loanExcludedIsolationGroups: number[]

  healthLtv: Decimal
  liquidationLtv: Decimal

  discountedNftCollateralValue: Decimal
  discountedCollateralValue: Decimal

  loanPositions: Record<string, LoanPositionData>
  collateralPositions: Record<string, CollateralPositionData>
  nftCollateralPositions: Record<string, NFTCollateralPositionData>
}
