import type {
  LedgerStateSelector,
  ProgrammaticScryptoSborValueEnum,
  StateEntityDetailsResponseFungibleResourceDetails,
  StateEntityDetailsResponseNonFungibleResourceDetails,
} from '@radixdlt/babylon-gateway-api-sdk'
import type { FungibleResourceCollectionState } from './owned-entity/fungible-resource-collection'
import type { NonFungibleResourceCollectionState } from './owned-entity/non-fungible-resource-collection'
import type EntityStateFetcher from './state-fetcher'

export type FungibleResourceState = {
  $entityAddress: string
  $metadata: Record<string, string>
} & {
  $type: 'FungibleResource'
  $details: StateEntityDetailsResponseFungibleResourceDetails
}

export type NonFungibleResourceState = {
  $entityAddress: string
  $metadata: Record<string, string>
} & {
  $type: 'NonFungibleResource'
  $details: StateEntityDetailsResponseNonFungibleResourceDetails
}

export type ResourceState = FungibleResourceState | NonFungibleResourceState

export interface BaseEntityState<T = any> {
  $entityAddress: string
  $fungibleResources: FungibleResourceCollectionState
  $nonFungibleResources: NonFungibleResourceCollectionState
  $metadata: Record<string, string>
  $state?: T
  initialized: boolean
}

export interface BaseNonFungibleData<T = any> {
  $entityAddress: string
  $nonFungibleId: string
  $owningVault?: string
  $owningVaultParent?: string
  $owningVaultAncestor?: string
  $data?: T
}

export interface FetchOptions {
  loadState: boolean
  loadResourceDetails: boolean
  recursiveFungibleResourceLoading: boolean
  recursiveNonFungibleResourceLoading: boolean
  ledgerStateSelector?: LedgerStateSelector
}

export interface EnumTransformerPlugin<T = any> {
  enumName: string[]// | string,
  parser: (
    field: { kind: 'Enum' } & ProgrammaticScryptoSborValueEnum,
    fetcher: EntityStateFetcher,
  ) => T
}

export interface TupleTransformerPlugin<T = any, I = any> {
  tupleName: string
  parser: (
    field: I,
    fetcher: EntityStateFetcher,
  ) => T
}
