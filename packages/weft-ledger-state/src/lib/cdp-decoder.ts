import type { CollateralizeDebtPositionData, CollateralPositionData, LoanPositionData, NFTCollateralPositionData, NFTLiquidationValue } from '../types/cdp'
import { dec } from '../../../state-fetcher/src/utils'

export function decodeCDP(id: string, encodedCDP: any): CollateralizeDebtPositionData {
  const cdp: CollateralizeDebtPositionData = {
    id,
    totalLoanValue: dec(encodedCDP[0].value),
    totalAdjustedLoanValue: dec(encodedCDP[1].value),
    totalCollateralValue: dec(encodedCDP[2].value),
    totalHealthCollateralValue: dec(encodedCDP[3].value),
    totalLiquidationCollateralValue: dec(encodedCDP[4].value),
    collateralIsolationGroups: [],
    loanExcludedIsolationGroups: [],
    healthLtv: dec(encodedCDP[7].value),
    liquidationLtv: dec(encodedCDP[8].value),
    discountedNftCollateralValue: dec(encodedCDP[9].value),
    discountedCollateralValue: dec(encodedCDP[10].value),
    loanPositions: {},
    collateralPositions: {},
    nftCollateralPositions: {},
  }

  const loans: Record<string, LoanPositionData> = {}

  encodedCDP[11].entries.forEach((loan: any) => {
    const loanData: any[] = loan.value.fields

    loans[loan.key.value] = {
      price: dec(loanData[0].value),
      units: dec(loanData[1].value),
      amount: dec(loanData[2].value),
      value: dec(loanData[3].value),
      adjustedValue: dec(loanData[4].value),
      config: {
        description: loanData[5].fields[0].value,
        loanValueFactor: dec(loanData[5].fields[1].value),
        loanCloseFactor: dec(loanData[5].fields[2].value),
      },
      configVersion: Number.parseInt(loanData[6].value),
      resourceConfig: {
        loanConfigId: Number.parseInt(loanData[7].fields[0].value),
        excludedIsolationGroupIds: [],
        efficiencyGroupId: loanData[7].fields[2].variant_id === '0'
          ? undefined
          : Number.parseInt(loanData[7].fields[2].fields[0].value),
      },
    }
  })

  cdp.loanPositions = loans

  const collaterals: Record<string, CollateralPositionData> = {}

  encodedCDP[12].entries.forEach((collateral: any) => {
    const collateralData: any[] = collateral.value.fields

    collaterals[collateral.key.value] = {
      price: dec(collateralData[0].value),
      amount: dec(collateralData[1].value),
      value: dec(collateralData[2].value),
      healthValue: dec(collateralData[3].value),
      liquidationValue: dec(collateralData[4].value),
      discountedValue: dec(collateralData[5].value),
      config: {
        description: collateralData[6].fields[0].value,
        loanToValueRatio: dec(collateralData[6].fields[1].value),
        liquidationThresholdSpread: dec(collateralData[6].fields[2].value),
        liquidationBonusRate: dec(collateralData[6].fields[3].value),
      },
      configVersion: {
        entryVersion: Number.parseInt(collateralData[7].fields[0].value),
        efficiencyMode: {
          variantId: collateralData[7].fields[1].variant_id,
          efficiencyGroupId: collateralData[7].fields[1].variant_id !== '1'
            ? undefined
            : Number.parseInt(collateralData[7].fields[1].fields[0].value),
        },
      },
      resourceConfig: {
        collateralConfigId: Number.parseInt(collateralData[8].fields[0].value),
        isolationGroupId: undefined,
        efficiencyGroupIds: collateralData[8].fields[2].elements.map((e: any) => Number.parseInt(e.value)),
      },
      isFromNft: false,
      resourceType: collateralData[10].variant_id === '0'
        ? { variantName: 'RegisteredToken' }
        : collateralData[10].variant_id === '1'
          ? { variantName: 'LSU', value: collateralData[10].fields[0].value }
          : { variantName: 'DepositUnit', value: collateralData[10].fields[0].value },
    }
  })

  cdp.collateralPositions = collaterals

  /// NFT Collaterals
  const nftCollaterals: Record<string, NFTCollateralPositionData> = {}

  encodedCDP[13].entries.forEach((nftCollateral: any) => {
    const nft_res_address = nftCollateral.key.value

    const nft_entries: any[] = nftCollateral.value.entries

    nft_entries.forEach((underlyingCollateral: any) => {
      const nft_id = underlyingCollateral.key.value

      const nftCollateralData: any[] = underlyingCollateral.value.fields

      // 0: Underlying resources

      const underlyingResources: Record<string, CollateralPositionData> = {}

      nftCollateralData[0].entries.forEach((collateral: any) => {
        const collateralData: any[] = collateral.value.fields

        underlyingResources[collateral.key.value] = {
          price: dec(collateralData[0].value),
          amount: dec(collateralData[1].value),
          value: dec(collateralData[2].value),
          healthValue: dec(collateralData[3].value),
          liquidationValue: dec(collateralData[4].value),
          discountedValue: dec(collateralData[5].value),
          config: {
            description: collateralData[6].fields[0].value,
            loanToValueRatio: dec(collateralData[6].fields[1].value),
            liquidationThresholdSpread: dec(collateralData[6].fields[2].value),
            liquidationBonusRate: dec(collateralData[6].fields[3].value),
          },
          configVersion: {
            entryVersion: Number.parseInt(collateralData[7].fields[0].value),
            efficiencyMode: collateralData[7].fields[1].variant_id,
          },
          resourceConfig: {
            collateralConfigId: Number.parseInt(collateralData[8].fields[0].value),
            isolationGroupId: undefined,
            efficiencyGroupIds: collateralData[8].fields[2].elements.map((e: any) => Number.parseInt(e.value)),
          },
          isFromNft: true,
          resourceType: collateralData[10].variant_id === '0'
            ? { variantName: 'RegisteredToken' }
            : collateralData[10].variant_id === '1'
              ? { variantName: 'LSU', value: collateralData[10].fields[0].value }
              : { variantName: 'DepositUnit', value: collateralData[10].fields[0].value },
        }
      })

      // 1: NFT Value

      const nftValue: NFTLiquidationValue = {
        value: dec(nftCollateralData[1].fields[0].value),
        discountedValue: dec(nftCollateralData[1].fields[1].value),
        loanPaymentValue: dec(nftCollateralData[1].fields[2].value),
        compensationValue: dec(nftCollateralData[1].fields[3].value),
        liquidationFee: dec(nftCollateralData[1].fields[4].value),
        resourceType: nftCollateralData[1].fields[5].variant_id === '0'
          ? { variantName: 'RegisteredNFT' }
          : { variantName: 'ClaimNFT', value: nftCollateralData[1].fields[5].fields[0].value },
      }

      const nFTCollateralPositionData: NFTCollateralPositionData = {
        underlyingPositions: underlyingResources,
        value: nftValue,
        maxAllowedDiscountedValue: dec(nftCollateralData[2].value),
      }

      nftCollaterals[`${nft_res_address}:${nft_id}`] = nFTCollateralPositionData
    })
  })

  cdp.nftCollateralPositions = nftCollaterals

  return cdp
}
