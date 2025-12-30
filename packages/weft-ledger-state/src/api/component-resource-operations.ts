import type { LedgerStateSelector } from '@radixdlt/babylon-gateway-api-sdk'
import type { LendingMarketState } from '../types/lending-market'
import type { ClaimNFT, FungibleResource, LSUResource, NonFungibleResource } from '../types/return-types'
import type { WeftLedgerStateClient } from './base-client'
import { dec, ZERO } from '../../../state-fetcher/src/utils'
import { duToResourceMapping, resourceToDuMapping } from '../lib/const'

export interface MarketResourceInfo {
  fungibleResources: FungibleResource[]
  lsuResources: LSUResource[]
  claimNfts: ClaimNFT[]
  nonFungibleResources: NonFungibleResource[]
}

export class ComponentResourceOperations {
  constructor(
    private client: WeftLedgerStateClient,
  ) {}

  async getResourceInfos(componentAddress: string[], ledgerStateSelector?: LedgerStateSelector): Promise<Record<string, MarketResourceInfo>> {
    const allValidatorAddressesSet = new Set<string>()

    const lendingMarketComponentStates = await
    this.client.getFetcher().fetchEntityState<LendingMarketState>(componentAddress, {
      ledgerStateSelector,
      loadResourceDetails: true,
    })

    const returnedResult: Record<string, MarketResourceInfo> = {}

    const tasks = lendingMarketComponentStates.map(async (lendingMarketComponentState) => {
      if (!lendingMarketComponentState)
        throw new Error('Invalid State')

      const marketState = lendingMarketComponentState.$state

      if (!marketState)
        throw new Error('Invalid State')

      const fungibleResources: FungibleResource[] = []
      const lsuResources: LSUResource[] = []

      Object.entries(lendingMarketComponentState?.$fungibleResources.values ?? {}).forEach(([address, data]) => {
        if (!data.amount.eq(ZERO)) {
          if (data.fungibleDetails?.$details.native_resource_details?.kind === 'ValidatorLiquidStakeUnit') {
            const lsu: LSUResource = {
              resourceAddress: address,
              amount: data.amount,
              unitRedemptionValue: dec(data.fungibleDetails?.$details.native_resource_details?.unit_redemption_value[0]?.amount ?? '0'),
              validatorAddress: data.fungibleDetails?.$details.native_resource_details?.validator_address,
              metadata: data.fungibleDetails?.$metadata,
              validatorMetadata: {},
            }

            lsuResources.push(lsu)
            allValidatorAddressesSet.add(lsu?.validatorAddress)
          }
          else {
            const fungibleCollateral: FungibleResource = {
              resourceAddress: address,
              duReverseAddress: duToResourceMapping.get(address),
              duAddress: resourceToDuMapping.get(address)?.du,
              amount: data.amount,
              metadata: data.fungibleDetails?.$metadata ?? {},
            }

            fungibleResources.push(fungibleCollateral)
          }
        }
      })

      const nonFungibleResources: NonFungibleResource[] = []
      const claimNfts: ClaimNFT[] = []

      Object.entries(lendingMarketComponentState?.$nonFungibleResources.values ?? {}).forEach(([address, data]) => {
        const ids = data.ids ?? []

        if (ids.length === 0) {
          return
        }

        if (data.nonFungibleDetails?.$details.native_resource_details?.kind === 'ValidatorClaimNft') {
          const claimNft: ClaimNFT = {
            resourceAddress: address,
            ids,
            validatorAddress: data.nonFungibleDetails?.$details.native_resource_details?.validator_address,
            metadata: data.nonFungibleDetails?.$metadata,
            validatorMetadata: {},
          }

          claimNfts.push(claimNft)
          allValidatorAddressesSet.add(claimNft?.validatorAddress)
        }
        else {
          nonFungibleResources.push({
            resourceAddress: address,
            ids,
            metadata: data.nonFungibleDetails?.$metadata ?? {},
          })
        }
      })

      const res = await this.client.getFetcher().fetchEntityState([...allValidatorAddressesSet], {
        loadState: true,
        loadResourceDetails: false,
        recursiveFungibleResourceLoading: false,
        recursiveNonFungibleResourceLoading: false,
      })

      res.forEach((state) => {
        const lsuIndex = lsuResources.findIndex(l => l.validatorAddress === state.$entityAddress)

        if (lsuIndex > -1) {
          lsuResources[lsuIndex]!.validatorMetadata = state.$metadata
        }

        const claimNftIndex = claimNfts.findIndex(l => l.validatorAddress === state.$entityAddress)

        if (claimNftIndex > -1) {
          claimNfts[claimNftIndex]!.validatorMetadata = state.$metadata
        }
      })

      returnedResult[lendingMarketComponentState.$entityAddress] = {
        fungibleResources,
        nonFungibleResources,
        lsuResources,
        claimNfts,
      }
    })

    await Promise.all(tasks)

    return returnedResult
  }
}
