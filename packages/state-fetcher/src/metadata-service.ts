import type { LedgerStateSelector, StateEntityDetailsResponseItemDetails } from '@radixdlt/babylon-gateway-api-sdk'
import type EntityStateFetcher from './state-fetcher'
import { BaseModel } from './base-model'
import { toCamelCase } from './utils'

type ResourceDetails = StateEntityDetailsResponseItemDetails
  & {
    type: 'FungibleResource' | 'NonFungibleResource'
    resourceAddress: string
    metadata: Record<string, any>
    validatorMetadata?: Record<string, any> | undefined
  }

interface CacheStrategy {
  get: (key: string) => ResourceDetails | undefined
  set: (key: string, value: ResourceDetails) => void
  has: (key: string) => boolean
  clear: () => void
}

class InMemoryCacheStrategy implements CacheStrategy {
  private cache: Map<string, ResourceDetails> = new Map()

  get(key: string): ResourceDetails | undefined {
    return this.cache.get(key)
  }

  set(key: string, value: ResourceDetails): void {
    this.cache.set(key, value)
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }
}

class LocalStorageCacheStrategy implements CacheStrategy {
  private readonly prefix = 'weft_metadata_'
  private readonly ttl: number

  constructor(ttlMs = 3600000) { // 1 hour default
    this.ttl = ttlMs
  }

  get(key: string): ResourceDetails | undefined {
    if (typeof localStorage === 'undefined')
      return undefined

    try {
      const item = localStorage.getItem(this.prefix + key)
      if (!item)
        return undefined

      const parsed = JSON.parse(item)
      if (Date.now() > parsed.expiry) {
        localStorage.removeItem(this.prefix + key)
        return undefined
      }

      return parsed.value
    }
    catch {
      return undefined
    }
  }

  set(key: string, value: ResourceDetails): void {
    if (typeof localStorage === 'undefined')
      return

    try {
      const item = {
        value,
        expiry: Date.now() + this.ttl,
      }
      localStorage.setItem(this.prefix + key, JSON.stringify(item))
    }
    catch {
      // Silent fail if localStorage is full or unavailable
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  clear(): void {
    if (typeof localStorage === 'undefined')
      return

    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key)
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key)
      }
    }
    catch {
      // Silent fail
    }
  }
}

export class MetadataService extends BaseModel {
  private resourceInfoState: Map<string, ResourceDetails> = new Map()
  private cacheStrategy: CacheStrategy
  private validatorMetadataCache: Map<string, Record<string, any>> = new Map()

  constructor(stateFetcher: EntityStateFetcher, useLocalStorage = false, ttlMs?: number) {
    super(stateFetcher)
    this.cacheStrategy = useLocalStorage
      ? new LocalStorageCacheStrategy(ttlMs)
      : new InMemoryCacheStrategy()
  }

  async getResourceDetails(resources: string[], ledgerStateSelector?: LedgerStateSelector): Promise<ResourceDetails[]> {
    const entityAddresses = [...new Set(resources)]
    const returnedResult: ResourceDetails[] = []
    const resourcesToFetch: string[] = []

    // Check cache first
    for (const address of entityAddresses) {
      const cached = this.cacheStrategy.get(address)
      if (cached) {
        returnedResult.push(cached)
      }
      else {
        resourcesToFetch.push(address)
      }
    }

    // If all resources are cached, return early
    if (resourcesToFetch.length === 0) {
      return returnedResult
    }

    const batchSize = 20
    const batches: string[][] = []

    for (let i = 0; i < resourcesToFetch.length; i += batchSize) {
      batches.push(resourcesToFetch.slice(i, i + batchSize))
    }

    const results = await Promise.all(
      batches.map(batch =>
        this.stateFetcher.stateApi.stateEntityDetails({
          stateEntityDetailsRequest: {
            at_ledger_state: ledgerStateSelector,
            addresses: batch,
            aggregation_level: 'Global',
            opt_ins: {
              native_resource_details: true,
            },
          },
        }),
      ),
    )

    this.stateFetcher.apiCallCount += batches.length

    for (const result of results) {
      for (const resourceState of result.items) {
        if (resourceState.details?.type === 'FungibleResource' || resourceState.details?.type === 'NonFungibleResource') {
          const metadata: Record<string, any> = {}

          resourceState.metadata.items.forEach(async (item) => {
            metadata[toCamelCase(item.key)] = (item.value.typed as any)?.value ?? (item.value.typed as any)?.values
          })

          const resourceInfo: ResourceDetails = {
            ...resourceState.details,
            resourceAddress: resourceState.address,
            metadata,
          }

          // Update state (but not cache yet - cache will be updated after validator metadata is fetched)
          this.resourceInfoState.set(resourceState.address, resourceInfo)
          returnedResult.push(resourceInfo)
        }
      }
    }

    // Collect validator addresses from all resources (both cached and newly fetched)
    const allValidatorAddressesSet = new Set<string>()
    const validatorAddressesToFetch = new Set<string>()

    returnedResult.forEach((r) => {
      if (r.native_resource_details?.kind === 'ValidatorClaimNft' || r.native_resource_details?.kind === 'ValidatorLiquidStakeUnit') {
        const validatorAddress = r.native_resource_details.validator_address
        allValidatorAddressesSet.add(validatorAddress)

        // Check if validator metadata is already cached
        if (this.validatorMetadataCache.has(validatorAddress)) {
          r.validatorMetadata = this.validatorMetadataCache.get(validatorAddress)
        }
        else {
          validatorAddressesToFetch.add(validatorAddress)
        }
      }
    })

    // Only fetch validator metadata if we have uncached validator addresses
    if (validatorAddressesToFetch.size > 0) {
      const res = await this.stateFetcher.fetchEntityState([...validatorAddressesToFetch], {
        loadState: true,
        loadResourceDetails: false,
        recursiveFungibleResourceLoading: false,
        recursiveNonFungibleResourceLoading: false,
      })

      res.forEach((state) => {
        // Cache the validator metadata
        this.validatorMetadataCache.set(state.$entityAddress, state.$metadata)

        // Update ALL resources that belong to this validator (not just the first one)
        returnedResult.forEach((resource) => {
          if ((resource.native_resource_details?.kind === 'ValidatorLiquidStakeUnit' || resource.native_resource_details?.kind === 'ValidatorClaimNft')
            && resource.native_resource_details?.validator_address === state.$entityAddress) {
            resource.validatorMetadata = state.$metadata
          }
        })
      })
    }

    // Cache all newly fetched resources after validator metadata has been added
    for (const address of resourcesToFetch) {
      const resource = returnedResult.find(r => r.resourceAddress === address)
      if (resource) {
        this.cacheStrategy.set(address, resource)
      }
    }

    return returnedResult
  }

  /**
   * Get a single resource from cache or state
   */
  getResourceFromCache(resourceAddress: string): ResourceDetails | undefined {
    return this.resourceInfoState.get(resourceAddress) ?? this.cacheStrategy.get(resourceAddress)
  }

  /**
   * Clear all cached resources and validator metadata
   */
  clearCache(): void {
    this.resourceInfoState.clear()
    this.cacheStrategy.clear()
    this.validatorMetadataCache.clear()
  }

  /**
   * Get all resources from state
   */
  getAllResourcesFromState(): ResourceDetails[] {
    return Array.from(this.resourceInfoState.values())
  }
}
