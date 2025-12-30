import type Decimal from 'decimal.js'

export declare type EfficiencyMode
  = | { variantName: 'None' }
    | { variantName: 'EfficiencyGroup', value: number }
    | { variantName: 'IdenticalResource' }

export declare interface CollateralConfigVersion {
  entryVersion: number
  efficiencyMode: EfficiencyMode
}

export declare interface CollateralInfo {
  amount: Decimal
  configVersion: CollateralConfigVersion
}

export declare interface NFTCollateralInfo {
  nftIds: string[]
  configVersion: Record<string, CollateralConfigVersion>
}

export declare interface LoanInfo {
  units: Decimal
  configVersion: number
}

export declare interface OnLedgerCdpData {
  id: string
  mintedAt: number
  keyImageUrl: string
  name: string
  description: string
  updatedAt: number
  collaterals: Record<string, CollateralInfo>
  nftCollaterals: Record<string, NFTCollateralInfo>
  loans: Record<string, LoanInfo>
}
