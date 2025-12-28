import {
  ManifestBuilder,
  address,
  array,
  bucket,
  decimal,
  enumeration,
  Expression,
  map,
  nonFungibleLocalId,
  ValueKind,
} from '@radixdlt/radix-engine-toolkit'

/**
 * Placeholder for the swap method.
 * In a real implementation, this would interact with a DEX (like Caviar or Ociswap)
 * to swap the collateral/unstaked assets for the required debt assets.
 */
export function swap(
  builder: ManifestBuilder,
  fromBucket: string,
  toResourceAddress: string,
): ManifestBuilder {
  // TODO: Implement actual swap logic using a DEX component
  // For now, this is a stub that represents the swap step.
  return builder.callMethod(
    address('component_tdx_2_1crgmz63jqnkzuwq3trghh9tlgtqnr3uyt7c006sfcw6xdr0c2q8tng'), // Placeholder DEX
    'swap',
    [bucket(fromBucket), address(toResourceAddress)],
  )
}

/**
 * Atomic liquidation for NFT collateral.
 */
export function liquidateNft(
  builder: ManifestBuilder,
  params: {
    accountAddress: string
    poolAddress: string
    liquidationCdpId: string
    debtResourceAddress: string
    debtAmount: string
    collateralNonFungibleAddress: string
    collateralNonFungibleId: string
    premiumAmount: string
    faucetAddress?: string // For XRD fees if needed
  },
): ManifestBuilder {
  const {
    accountAddress,
    poolAddress,
    liquidationCdpId,
    debtResourceAddress,
    debtAmount,
    collateralNonFungibleAddress,
    collateralNonFungibleId,
    premiumAmount,
  } = params

  return builder
    // 1. Flash loan the debt asset from the pool
    .callMethod(poolAddress, 'take_flash_loan', [
      map(ValueKind.Address, ValueKind.Decimal, [[address(debtResourceAddress), decimal(debtAmount)]]),
    ])
    // 2. Withdraw premium (XRD) for the NFT liquidation bonus if needed from account
    .callMethod(accountAddress, 'withdraw', [
      address('resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'), // XRD
      decimal(premiumAmount),
    ])
    .takeFromWorktop(
      'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
      decimal(premiumAmount),
      (builder, premiumBucket) => {
        return builder.takeAllFromWorktop(
          debtResourceAddress,
          (builder, debtBucket) => {
            // 3. Perform the NFT liquidation
            return builder.callMethod(
              address('component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57'), // Weft Liquidator Component
              'liquidate_nft',
              [
                nonFungibleLocalId(liquidationCdpId),
                [bucket(debtBucket)],
                address(collateralNonFungibleAddress),
                nonFungibleLocalId(collateralNonFungibleId),
                bucket(premiumBucket),
              ],
            )
          },
        )
      },
    )
    // 4. Repay the flash loan
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, repayBucket) => {
        return builder.takeAllFromWorktop(
          'resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d', // Flash loan term resource
          (builder, termBucket) => {
            return builder.callMethod(poolAddress, 'repay_flash_loan', [
              [bucket(repayBucket)],
              bucket(termBucket),
            ])
          },
        )
      },
    )
    // 5. Deposit remaining assets (if any) back to account
    .callMethod(accountAddress, 'deposit_batch', [Expression.EntireWorktop])
}

/**
 * Atomic liquidation for LSU collateral.
 */
export function liquidateLsu(
  builder: ManifestBuilder,
  params: {
    accountAddress: string
    poolAddress: string
    liquidationCdpId: string
    debtResourceAddress: string
    debtAmount: string
    lsuResourceAddress: string
    validatorAddress: string
  },
): ManifestBuilder {
  const {
    accountAddress,
    poolAddress,
    liquidationCdpId,
    debtResourceAddress,
    debtAmount,
    lsuResourceAddress,
    validatorAddress,
  } = params

  return builder
    // 1. Flash loan
    .callMethod(poolAddress, 'take_flash_loan', [
      new Map([[address(debtResourceAddress), decimal(debtAmount)]]),
    ])
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, debtBucket) => {
        // 2. Liquidate
        return builder.callMethod(
          address('component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57'),
          'liquidate',
          [
            nonFungibleLocalId(liquidationCdpId),
            [bucket(debtBucket)],
            // Enum for collateral selection (LSU in this case)
            enumeration(1, array(ValueKind.Address, address(lsuResourceAddress))),
          ],
        )
      },
    )
    // 3. Unstake LSU to get XRD (or unstake claim NFT)
    .takeAllFromWorktop(
      lsuResourceAddress,
      (builder, lsuBucket) => {
        return builder.callMethod(validatorAddress, 'unstake', [bucket(lsuBucket)])
      },
    )
    // 4. Handle unstake result (usually an NFT or XRD)
    // If it's a claim NFT, we might need more steps.
    // For now, let's assume we might need to swap if debt asset is not XRD
    .takeAllFromWorktop(
      'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
      (builder, xrdBucket) => {
        if (debtResourceAddress !== 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc') {
          return swap(builder, xrdBucket, debtResourceAddress)
        }
        return builder
      },
    )
    // 5. Repay flash loan
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, repayBucket) => {
        return builder.takeAllFromWorktop(
          'resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d',
          (builder, termBucket) => {
            return builder.callMethod(poolAddress, 'repay_flash_loan', [
              [bucket(repayBucket)],
              bucket(termBucket),
            ])
          },
        )
      },
    )
    .callMethod(accountAddress, 'deposit_batch', [Expression.EntireWorktop])
}

/**
 * Atomic liquidation for Fungible collateral.
 */
export function liquidateFungible(
  builder: ManifestBuilder,
  params: {
    accountAddress: string
    poolAddress: string
    liquidationCdpId: string
    debtResourceAddress: string
    debtAmount: string
    collateralResourceAddress: string
  },
): ManifestBuilder {
  const {
    accountAddress,
    poolAddress,
    liquidationCdpId,
    debtResourceAddress,
    debtAmount,
    collateralResourceAddress,
  } = params

  return builder
    // 1. Flash loan
    .callMethod(poolAddress, 'take_flash_loan', [
      new Map([[address(debtResourceAddress), decimal(debtAmount)]]),
    ])
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, debtBucket) => {
        // 2. Liquidate
        return builder.callMethod(
          address('component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57'),
          'liquidate',
          [
            nonFungibleLocalId(liquidationCdpId),
            [bucket(debtBucket)],
            enumeration(1, array(ValueKind.Address, address(collateralResourceAddress))),
          ],
        )
      },
    )
    // 3. Swap collateral for debt asset if needed
    .takeAllFromWorktop(
      collateralResourceAddress,
      (builder, collateralBucket) => {
        return swap(builder, collateralBucket, debtResourceAddress)
      },
    )
    // 4. Repay flash loan
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, repayBucket) => {
        return builder.takeAllFromWorktop(
          'resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d',
          (builder, termBucket) => {
            return builder.callMethod(poolAddress, 'repay_flash_loan', [
              [bucket(repayBucket)],
              bucket(termBucket),
            ])
          },
        )
      },
    )
    .callMethod(accountAddress, 'deposit_batch', [Expression.EntireWorktop])
}

/**
 * Atomic liquidation for Deposit Unit collateral.
 */
export function liquidateDepositUnit(
  builder: ManifestBuilder,
  params: {
    accountAddress: string
    poolAddress: string
    liquidationCdpId: string
    debtResourceAddress: string
    debtAmount: string
    depositUnitResourceAddress: string
    lendingPoolAddress: string
  },
): ManifestBuilder {
  const {
    accountAddress,
    poolAddress,
    liquidationCdpId,
    debtResourceAddress,
    debtAmount,
    depositUnitResourceAddress,
    lendingPoolAddress,
  } = params

  return builder
    // 1. Flash loan
    .callMethod(poolAddress, 'take_flash_loan', [
      new Map([[address(debtResourceAddress), decimal(debtAmount)]]),
    ])
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, debtBucket) => {
        // 2. Liquidate
        return builder.callMethod(
          address('component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57'),
          'liquidate',
          [
            nonFungibleLocalId(liquidationCdpId),
            [bucket(debtBucket)],
            enumeration(1, array(ValueKind.Address, address(depositUnitResourceAddress))),
          ],
        )
      },
    )
    // 3. Withdraw underlying from lending pool
    .takeAllFromWorktop(
      depositUnitResourceAddress,
      (builder, duBucket) => {
        // Assuming the lending pool has a 'withdraw' method for deposit units
        return builder.callMethod(lendingPoolAddress, 'withdraw', [[bucket(duBucket)]])
      },
    )
    // 4. Swap underlying for debt asset (logic depends on what was withdrawn)
    // This is simplified here; actual logic might need to know which resource was withdrawn
    .takeFromWorktop(
      // This is a placeholder for the underlying resource address
      'underlying_resource_address_placeholder',
      decimal('0'), // Placeholder
      (builder, underlyingBucket) => {
        return swap(builder, underlyingBucket, debtResourceAddress)
      },
    )
    // 5. Repay flash loan
    .takeAllFromWorktop(
      debtResourceAddress,
      (builder, repayBucket) => {
        return builder.takeAllFromWorktop(
          'resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d',
          (builder, termBucket) => {
            return builder.callMethod(poolAddress, 'repay_flash_loan', [
              [bucket(repayBucket)],
              bucket(termBucket),
            ])
          },
        )
      },
    )
    .callMethod(accountAddress, 'deposit_batch', [Expression.EntireWorktop])
}
