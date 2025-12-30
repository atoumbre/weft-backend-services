import type {
  GatewayApiClient,
  LedgerStateSelector,
  ProgrammaticScryptoSborValue,
  StateApi,
} from '@radixdlt/babylon-gateway-api-sdk'
import type { BaseEntityState, BaseNonFungibleData, EnumTransformerPlugin, FetchOptions, ResourceState, TupleTransformerPlugin } from './types'
import { ComponentState } from './owned-entity/component-state'
import { FungibleResourceCollectionState } from './owned-entity/fungible-resource-collection'
import { KeyValueStore } from './owned-entity/key-value-store'
import { NonFungibleResourceCollectionState } from './owned-entity/non-fungible-resource-collection'
import { dec, findIndexes, toCamelCase } from './utils'

const defaultOptions: FetchOptions = {
  loadState: true,
  recursiveFungibleResourceLoading: true,
  recursiveNonFungibleResourceLoading: true,
  loadResourceDetails: false,
}

export const optionTransformPlugin: EnumTransformerPlugin = {
  enumName: ['Option'],
  parser: (field, fetcher) => {
    if (field.variant_id === '0' || field.variant_name === 'None') {
      return undefined
    }

    const value = field.fields.length === 1
      ? fetcher.fetchField(field.fields[0])
      : field.fields.map(v => fetcher.fetchField(v))

    return value
  },
}

export default class EntityStateFetcher {
  gatewayApi: GatewayApiClient
  apiCallCount: number = 0
  private options: FetchOptions
  private enumPlugins: EnumTransformerPlugin[] = []
  private tuplePlugins: TupleTransformerPlugin[] = []
  private resourceStateCache: Record<string, ResourceState> = {}

  constructor(
    gatewayApi: GatewayApiClient,
    { enumPlugins, tuplePlugins, options }: {
      options?: FetchOptions
      enumPlugins?: EnumTransformerPlugin | EnumTransformerPlugin[]
      tuplePlugins?: TupleTransformerPlugin | TupleTransformerPlugin[]
    } = {},
  ) {
    this.gatewayApi = gatewayApi

    this.addEnumPlugin(optionTransformPlugin)

    this.addPlugins({ enumPlugins, tuplePlugins })

    this.options = { ...defaultOptions, ...options }
  }

  get stateApi(): StateApi {
    return this.gatewayApi.state.innerClient
  }

  static newBaseState<T = any>($entityAddress: string, stateFetcher: EntityStateFetcher): BaseEntityState<T> {
    return {
      $entityAddress,

      $fungibleResources: new FungibleResourceCollectionState($entityAddress, stateFetcher),
      $nonFungibleResources: new NonFungibleResourceCollectionState($entityAddress, stateFetcher),

      $metadata: {},

      $state: undefined,

      initialized: false,
    }
  }

  addPlugins({ enumPlugins, tuplePlugins }: {
    enumPlugins?: EnumTransformerPlugin | EnumTransformerPlugin[]
    tuplePlugins?: TupleTransformerPlugin | TupleTransformerPlugin[]
  }): void {
    if (enumPlugins)
      this.addEnumPlugin(enumPlugins)
    if (tuplePlugins)
      this.addTuplePlugin(tuplePlugins)
  }

  addEnumPlugin(plugin: EnumTransformerPlugin | EnumTransformerPlugin[]): void {
    if (!Array.isArray(plugin))
      plugin = [plugin]
    this.enumPlugins.push(...plugin)
  }

  addTuplePlugin(plugin: TupleTransformerPlugin | TupleTransformerPlugin[]): void {
    if (!Array.isArray(plugin))
      plugin = [plugin]
    this.tuplePlugins.push(...plugin)
  }

  setOptions(options: FetchOptions): void {
    this.options = options
  }

  async fetchEntityState<T = any>(entityAddressesInput: string[], localFetchOptions: Partial<FetchOptions> = this.options): Promise<BaseEntityState<T>[]> {
    let returnedStates: BaseEntityState<T>[] = []

    const fetchOptions: FetchOptions = { ...this.options, ...localFetchOptions }

    // remove duplicate
    const entityAddresses = [...new Set(entityAddressesInput)]

    const batchSize = 20
    let batch = []

    for (let i = 0; i < entityAddresses.length; i += batchSize) {
      batch = entityAddresses.slice(i, i + batchSize)

      const result = await this.stateApi.stateEntityDetails({
        stateEntityDetailsRequest: {
          at_ledger_state: fetchOptions.ledgerStateSelector,
          addresses: batch,
          aggregation_level: 'Vault',
          opt_ins: {
            non_fungible_include_nfids: true,
          },
        },
      })
      this.apiCallCount++

      if (result.items.length === 0)
        return []

      const tasks = result.items.map(async (entity) => {
        const v = EntityStateFetcher.newBaseState<T>(entity.address, this)

        // RESOURCES

        await Promise.all([
          (async () => {
            if (entity.fungible_resources) {
              v.$fungibleResources.setInitialValues({
                initialValues: { fungible_resources: entity.fungible_resources, state_version: result.ledger_state.state_version },
              })

              if (fetchOptions.recursiveFungibleResourceLoading) {
                await v.$fungibleResources.loadMore(true)
              }
            }
          })(),

          (async () => {
            if (entity.non_fungible_resources) {
              v.$nonFungibleResources.setInitialValues({
                initialValues: { non_fungible_resources: entity.non_fungible_resources, state_version: result.ledger_state.state_version },
              })

              if (fetchOptions.recursiveNonFungibleResourceLoading) {
                await v.$nonFungibleResources.loadMore(true)
              }
            }
          })(),
        ])

        // METADATA

        entity.metadata.items.forEach(async (item) => {
          v.$metadata[toCamelCase(item.key)] = (item.value.typed as any)?.value ?? (item.value.typed as any)?.values
        })

        // STATE
        if (fetchOptions.loadState) {
          switch (entity.details?.type) {
            case 'Component': {
              v.$state = await this.fetchField(entity.details.state as ProgrammaticScryptoSborValue) as T
              break
            }
            case 'FungibleResource':
              v.$state = entity.details as T
              break

            case 'NonFungibleResource':
              v.$state = entity.details as T
              break

            case 'FungibleVault':
              v.$state = entity.details as T
              break

            case 'NonFungibleVault':
              v.$state = entity.details as T
              break

            case 'Package':
              v.$state = entity.details as T
              break

            default:
              v.$state = entity.details as T
              break
          }
        }

        v.initialized = true

        return v
      })

      const taskResult = await Promise.all(tasks)
      returnedStates = returnedStates.concat(taskResult)
    }

    if (fetchOptions.loadResourceDetails) {
      // Get all entities resource addresses (FungibleResource, NonFungibleResource)
      const resources = returnedStates.map((state) => {
        const resAddress: string[] = []

        Object.entries(state.$fungibleResources.values).forEach(([key, _]) => {
          // if (value.amount.gt(ZERO)) {
          resAddress.push(key)
          // }
        })

        Object.entries(state.$nonFungibleResources.values).forEach(([key, _]) => {
          // if (value.totalCount > 0) {
          resAddress.push(key)
          // }
        })

        return resAddress
      }).flat()

      const resourcesStates = await this.fetchResourceState([...new Set(resources)])

      for (let i = 0; i < returnedStates.length; i++) {
        Object.entries(returnedStates[i]!.$fungibleResources.values).forEach(([key, _]) => {
          const resState = resourcesStates.find(r => r.$entityAddress === key)

          if (resState?.$type !== 'FungibleResource')
            return

          returnedStates[i]!.$fungibleResources.values[key]!.fungibleDetails = resState
        })

        Object.entries(returnedStates[i]!.$nonFungibleResources.values).forEach(([key, _]) => {
          const resState = resourcesStates.find(r => r.$entityAddress === key)

          if (resState?.$type !== 'NonFungibleResource')
            return

          returnedStates[i]!.$nonFungibleResources.values[key]!.nonFungibleDetails = resState
        })
      }
    }

    return returnedStates
  }

  async fetchNftData<T = any>(nonFungibleResourceAddress: string, nonFungibleLocalIds: string[], fetchOptions?: { loadLocations?: boolean, ledgerStateSelector?: LedgerStateSelector },
  ): Promise<BaseNonFungibleData<T>[]> {
    let nftIdCount = nonFungibleLocalIds.length

    if (nftIdCount === 0)
      return []

    const fetchedNftData: BaseNonFungibleData<T>[] = []

    const loadedIds = new Set<string>()

    while (nftIdCount > 0) {
      const returnedResult: BaseNonFungibleData<T>[] = []

      // proceed by batch of 99
      const nb = Math.min(99, nftIdCount)
      nftIdCount -= nb

      // Skip already loaded ids
      const idsToLoad = nonFungibleLocalIds.slice(nftIdCount, nftIdCount + nb).filter(id => !loadedIds.has(id))
      if (idsToLoad.length === 0)
        continue

      const fetchResult = await this.stateApi.nonFungibleData({
        stateNonFungibleDataRequest: {
          at_ledger_state: fetchOptions?.ledgerStateSelector,
          resource_address: nonFungibleResourceAddress,
          non_fungible_ids: idsToLoad,
        },
      })
      this.apiCallCount++

      if (!fetchResult?.non_fungible_ids)
        return []

      const tasks = fetchResult.non_fungible_ids.map(async (nftFetchResult) => {
        if (nftFetchResult.data === undefined) {
          return
        }

        const nftRawData = nftFetchResult.data?.programmatic_json

        const state = await this.fetchField(nftRawData as ProgrammaticScryptoSborValue) as T

        const res: BaseNonFungibleData<T> = {
          $entityAddress: nonFungibleResourceAddress,
          $nonFungibleId: nftFetchResult.non_fungible_id,
          $data: state,
        }

        returnedResult.push(res)

        loadedIds.add(nftFetchResult.non_fungible_id)
      })

      await Promise.all(tasks)

      // Load locations and account addresses
      if (fetchOptions?.loadLocations ?? false) {
        // Load owning vaults and update NFT data $owningVault field
        const locations = await this.stateApi.nonFungibleLocation({
          stateNonFungibleLocationRequest: {
            at_ledger_state: fetchOptions?.ledgerStateSelector,
            resource_address: nonFungibleResourceAddress,
            non_fungible_ids: idsToLoad,
          },
        })
        this.apiCallCount++

        // Update NFT data owningVault field
        locations.non_fungible_ids.forEach((location) => {
          const indexes: any[] = findIndexes(returnedResult, nftData => nftData.$nonFungibleId === location.non_fungible_id)

          indexes.forEach((index) => {
            returnedResult[index]!.$owningVault = location.owning_vault_address
            returnedResult[index]!.$owningVaultParent = location.owning_vault_parent_ancestor_address
            returnedResult[index]!.$owningVaultAncestor = location.owning_vault_global_ancestor_address
          })
        })
      }

      returnedResult.forEach((nftData) => {
        fetchedNftData.push(nftData)
      })
    }

    return fetchedNftData
  }

  async fetchResourceState(entityAddressesInput: string[], fetchOptions?: { ledgerStateSelector?: LedgerStateSelector }): Promise<ResourceState[]> {
    let returnedStates: ResourceState[] = []

    // remove duplicate
    const entityAddresses = [...new Set(entityAddressesInput)]

    const batchSize = 20
    let batch = []

    for (let i = 0; i < entityAddresses.length; i += batchSize) {
      batch = entityAddresses.slice(i, i + batchSize)

      const result = await this.stateApi.stateEntityDetails({
        stateEntityDetailsRequest: {
          at_ledger_state: fetchOptions?.ledgerStateSelector,
          addresses: batch,
          aggregation_level: 'Global',
          opt_ins: {
            native_resource_details: true,
          },
        },
      })
      this.apiCallCount++

      if (result.items.length === 0)
        return []

      const tasks = result.items.map(async (resourceState) => {
        let v: ResourceState | undefined

        if (resourceState.details?.type === 'FungibleResource') {
          v = {
            $type: resourceState.details?.type,
            $entityAddress: resourceState.address,
            $metadata: {} as Record<string, string>,
            $details: resourceState.details,
          }
        }

        if (resourceState.details?.type === 'NonFungibleResource') {
          v = {
            $type: resourceState.details?.type,
            $entityAddress: resourceState.address,
            $metadata: {} as Record<string, string>,
            $details: resourceState.details,
          }
        }

        if (v === undefined)
          return

        this.resourceStateCache[resourceState.address] = v

        resourceState.metadata.items.forEach(async (item) => {
          v.$metadata[toCamelCase(item.key)] = (item.value.typed as any)?.value ?? (item.value.typed as any)?.values
        })

        return v
      })

      const taskResult = await Promise.all(tasks)

      returnedStates = returnedStates.concat(taskResult.filter(item => item !== undefined))
    }

    return returnedStates
  }

  fetchField(field: ProgrammaticScryptoSborValue | undefined): any {
    let value: any

    if (field === undefined)
      return value

    switch (field.kind) {
      case 'Reference':
      case 'Bool':
      case 'String':
      case 'NonFungibleLocalId': {
        value = field.value
        break
      }

      case 'U8':
      case 'I8':
      case 'U16':
      case 'I16':
      case 'U32':
      case 'I32':
      case 'U64':
      case 'I64':
      case 'U128':
      case 'I128': {
        value = Number.parseInt(field.value)
        break
      }

      case 'Decimal': {
        value = dec(field.value)
        break
      }

      case 'PreciseDecimal': {
        value = dec(field.value)
        break
      }

      case 'Map': {
        const tempMap: Record<any, any> = {}

        field.entries.forEach((entry: any) => {
          const [key, val] = [this.fetchField(entry.key), this.fetchField(entry.value)]

          tempMap[key] = val
        })

        value = tempMap

        break
      }

      case 'Array': {
        const tempArray: Record<string, any> = []

        field.elements.forEach(entry => tempArray.push(this.fetchField(entry)))

        value = tempArray

        break
      }

      case 'Enum': {
        const enumPlugin = this.enumPlugins.reverse().find((plugin) => {
          if (field.type_name === undefined || field.type_name === null)
            return undefined

          else
            return plugin.enumName.includes(field.type_name)
        })

        if (enumPlugin) {
          value = enumPlugin.parser(field, this)
        }
        else {
          if (field.fields.length > 0) {
            value = {
              variantId: field.variant_id,
              variantName: field.variant_name,
              value:
                field.fields.length === 1
                  ? this.fetchField(field.fields[0])
                  : field.fields.map(v => this.fetchField(v)),
            }
          }
          else {
            value = { variantId: field.variant_id, variantName: field.variant_name }
          }
        }

        break
      }

      case 'Tuple': {
        if (field.fields.length === 0) {
          value = {}
          break
        }

        const values: Record<string, any> = {}

        field.fields.forEach((subField, index) => {
          const key = subField.field_name ? toCamelCase(subField.field_name) : `_unnamedField${index}`

          values[key] = this.fetchField(subField)
        })

        const tuplePlugin = this.tuplePlugins.reverse().find(plugin => plugin.tupleName === field.type_name)

        value = tuplePlugin ? tuplePlugin.parser(values, this) : values

        break
      }

      case 'Own': {
        if (
          field.type_name === 'Vault'
          || field.type_name === 'FungibleVault'
          || field.type_name === 'NonFungibleVault'
        ) {
          value = field.value
        }

        else if (field.type_name === 'KeyValueStore') {
          value = new KeyValueStore(field.value, this)
        }

        else {
          value = new ComponentState(field.value, this)
        }

        break
      }

      default: {
        // Not yet supported
        value = field
        break
      }
    }

    return value
  }
}
