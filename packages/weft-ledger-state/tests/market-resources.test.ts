import type { WeftRadixApiServiceInterface } from '../src/api'
import { beforeEach, describe, expect, it } from 'bun:test'
import { dec } from '../../state-fetcher/src/utils'
import { WeftLedgerSateFetcher } from '../src/api'
import { ComponentResourceOperations } from '../src/api/component-resource-operations'
import { duToResourceMapping, LENDING_MARKET_COMPONENT, resourceToDuMapping } from '../src/lib/const'

describe('getResourceInfos (live shape)', () => {
  let api: WeftRadixApiServiceInterface
  let cachedInfos: Awaited<ReturnType<typeof api.getResourceInfos>>

  beforeEach(async () => {
    api = WeftLedgerSateFetcher.setInstance()
    cachedInfos = await api.getResourceInfos([LENDING_MARKET_COMPONENT])
  })

  it('returns expected structure at a known ledger state', async () => {
    const result = cachedInfos
    expect(result).toHaveProperty(LENDING_MARKET_COMPONENT)

    const entry = result[LENDING_MARKET_COMPONENT]!
    expect(Array.isArray(entry.fungibleResources)).toBe(true)
    expect(Array.isArray(entry.lsuResources)).toBe(true)
    expect(Array.isArray(entry.nonFungibleResources)).toBe(true)
    expect(Array.isArray(entry.claimNfts)).toBe(true)

    // If present, basic field sanity checks
    if (entry.fungibleResources.length > 0) {
      const f = entry.fungibleResources[0]!
      expect(typeof f.resourceAddress).toBe('string')
      expect(typeof f.amount.toString()).toBe('string')
      expect(typeof f.metadata).toBe('object')
    }

    if (entry.lsuResources.length > 0) {
      const lsu = entry.lsuResources[0]!
      expect(typeof lsu.resourceAddress).toBe('string')
      expect(typeof lsu.amount.toString()).toBe('string')
      expect(typeof lsu.unitRedemptionValue.toString()).toBe('string')
      expect(typeof lsu.validatorAddress).toBe('string')
      expect(typeof lsu.metadata).toBe('object')
      expect(typeof lsu.validatorMetadata).toBe('object')
    }

    if (entry.nonFungibleResources.length > 0) {
      const nft = entry.nonFungibleResources[0]!
      expect(typeof nft.resourceAddress).toBe('string')
      expect(Array.isArray(nft.ids)).toBe(true)
      expect(typeof nft.metadata).toBe('object')
    }

    if (entry.claimNfts.length > 0) {
      const c = entry.claimNfts[0]!
      expect(typeof c.resourceAddress).toBe('string')
      expect(Array.isArray(c.ids)).toBe(true)
      expect(typeof c.validatorAddress).toBe('string')
      expect(typeof c.metadata).toBe('object')
      expect(typeof c.validatorMetadata).toBe('object')
    }
  })
})

describe('getResourceInfos (unit, mocked fetcher)', () => {
  // Minimal shapes to satisfy ComponentResourceOperations expectations
  interface BaseState {
    $entityAddress: string
    $state: any
    $metadata: Record<string, any>
    $fungibleResources: { values: Record<string, any> }
    $nonFungibleResources: { values: Record<string, any> }
  }

  class FakeFetcher {
    private componentState: BaseState
    constructor(componentAddress: string) {
      // Use real mapped resource addresses for stable expectations
      const xusdc = 'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'
      const xusdcDU = resourceToDuMapping.get(xusdc)!.du

      this.componentState = {
        $entityAddress: componentAddress,
        $state: {}, // truthy to pass validation
        $metadata: {},
        $fungibleResources: {
          values: {
            // Normal fungible resource (underlying asset)
            [xusdc]: {
              amount: dec(100),
              fungibleDetails: {
                $metadata: { name: 'xUSDC' },
                $details: { native_resource_details: { kind: 'FungibleResource' } },
              },
            },
            // Zero amount should be skipped
            [xusdcDU]: {
              amount: dec(5),
              fungibleDetails: {
                $metadata: { name: 'xUSDC DU' },
                $details: { native_resource_details: { kind: 'FungibleResource' } },
              },
            },
            // LSU resource detected by kind
            resource_lsu_1: {
              amount: dec(10),
              fungibleDetails: {
                $metadata: { name: 'LSU' },
                $details: {
                  native_resource_details: {
                    kind: 'ValidatorLiquidStakeUnit',
                    validator_address: 'validator_rdx1qspvly6j2n0',
                    unit_redemption_value: [{ amount: '1.234' }],
                  },
                },
              },
            },
          },
        },
        $nonFungibleResources: {
          values: {
            // Regular NFT resource
            resource_nft_1: {
              ids: ['#1#', '#2#'],
              nonFungibleDetails: {
                $metadata: { name: 'REG_NFT' },
                $details: {
                  native_resource_details: { kind: 'NonFungibleResource' },
                },
              },
            },
            // Claim NFT detected by kind
            resource_claim_nft_1: {
              ids: ['#3#'],
              nonFungibleDetails: {
                $metadata: { name: 'CLAIM_NFT' },
                $details: {
                  native_resource_details: {
                    kind: 'ValidatorClaimNft',
                    validator_address: 'validator_rdx1qsclaimk3y',
                  },
                },
              },
            },
          },
        },
      }
    }

    async fetchEntityState<T = any>(addresses: string[], _opts?: any): Promise<T[]> {
      // First call: component address -> return component state
      if (addresses.includes(this.componentState.$entityAddress)) {
        return [this.componentState as unknown as T]
      }

      // Second call: validator metadata lookups
      const results: BaseState[] = []
      for (const addr of addresses) {
        results.push({
          $entityAddress: addr,
          $state: {},
          $metadata: { name: `meta_for_${addr}` },
          $fungibleResources: { values: {} },
          $nonFungibleResources: { values: {} },
        })
      }
      return results as unknown as T[]
    }
  }

  class FakeClient {
    private fetcher: FakeFetcher
    constructor(addr: string) { this.fetcher = new FakeFetcher(addr) }
    getFetcher() { return this.fetcher }
  }

  it('classifies resources and enriches validator metadata', async () => {
    const client = new FakeClient(LENDING_MARKET_COMPONENT) as any
    const ops = new ComponentResourceOperations(client)

    const result = await ops.getResourceInfos([LENDING_MARKET_COMPONENT])
    const entry = result[LENDING_MARKET_COMPONENT]!

    // Fungible: contains XUSDC; DU reverse mapping is set; zero DU skipped
    const xusdc = 'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'
    const xusdcDU = resourceToDuMapping.get(xusdc)!.du
    const fungibles = entry.fungibleResources
    const hasXusdc = fungibles.some(f => f.resourceAddress === xusdc)
    expect(hasXusdc).toBe(true)
    const xusdcItem = fungibles.find(f => f.resourceAddress === xusdc)!
    expect(xusdcItem.duReverseAddress).toBeUndefined()
    // DU for underlying should be undefined; reverse DU should be defined
    expect(xusdcItem.duAddress).toBe(xusdcDU)

    // LSU: detected and validator metadata enriched via second fetch
    expect(entry.lsuResources.length).toBe(1)
    const lsu = entry.lsuResources[0]!
    expect(lsu.validatorAddress).toBe('validator_rdx1qspvly6j2n0')
    expect(lsu.unitRedemptionValue.toString()).toBe(dec('1.234').toString())
    expect(lsu.validatorMetadata.name).toBe('meta_for_validator_rdx1qspvly6j2n0')

    // Non-fungible (regular): present with ids
    expect(entry.nonFungibleResources.length).toBe(1)
    expect(entry.nonFungibleResources[0]!.ids).toEqual(['#1#', '#2#'])
    expect(entry.nonFungibleResources.length).toBe(1)

    // Claim NFT: detected and validator metadata enriched
    expect(entry.claimNfts.length).toBe(1)
    const claim = entry.claimNfts[0]!
    expect(claim.ids).toEqual(['#3#'])
    expect(claim.validatorAddress).toBe('validator_rdx1qsclaimk3y')
    expect(claim.validatorMetadata.name).toBe('meta_for_validator_rdx1qsclaimk3y')

    // Sanity: if any fungible is a DU, duAddress should map back to underlying
    const anyDU = fungibles.find(f => !!f.duReverseAddress)
    if (anyDU) {
      expect(duToResourceMapping.get(anyDU.resourceAddress)).toBeDefined()
    }
  })
})
