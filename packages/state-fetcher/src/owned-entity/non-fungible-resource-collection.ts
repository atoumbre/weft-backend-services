import type { LedgerStateSelector, NonFungibleResourcesCollection } from '@radixdlt/babylon-gateway-api-sdk'
import type EntityStateFetcher from '../state-fetcher'
import type { NonFungibleResourceState } from '../types'

export type NonFungibleResourceCollectionItem = {
  totalCount: number
  ids?: string[]
  nonFungibleDetails?: NonFungibleResourceState
} & (
  | { aggregationLevel: 'Global' }
  | { aggregationLevel: 'Vault', vaults: Record<string, NonFungibleVaultState> }
)

export interface NonFungibleVaultState {
  resourceAddress: string
  totalCount: number
  ids: string[]
}

export class NonFungibleResourceCollectionState {
  entity: string
  values: Record<string, NonFungibleResourceCollectionItem> = {} as Record<string, NonFungibleResourceCollectionItem>

  private initialized = false
  private stateFetcher: EntityStateFetcher
  private cursor: { cursor: string | null | undefined, stateVersion: number }

  constructor(entity: string, stateFetcher: EntityStateFetcher) {
    this.entity = entity
    this.stateFetcher = stateFetcher
    this.cursor = { cursor: undefined, stateVersion: 0 }
    this.initialized = false
  };

  get hasMore(): boolean {
    return !!this.cursor?.cursor
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  private reset(): void {
    this.values = {} as Record<string, NonFungibleResourceCollectionItem>
    this.cursor = { cursor: undefined, stateVersion: 0 }
  }

  async init({ aggregationLevel, ledgerStateSelector, recursive }: {
    aggregationLevel?: 'Global' | 'Vault'
    ledgerStateSelector?: LedgerStateSelector
    recursive?: boolean
  }): Promise<void> {
    this.reset()

    await this.loadValues({ aggregationLevel, recursive, ledgerStateSelector })

    this.initialized = true
  }

  async setInitialValues({ initialValues }: {
    initialValues: { non_fungible_resources: NonFungibleResourcesCollection | undefined, state_version: number }
  }): Promise<void> {
    this.reset()

    this.parseValues(initialValues)

    this.initialized = true
  }

  async loadMore(recursive: boolean = false): Promise<void> {
    if (!this.hasMore)
      return
    await this.loadValues({ recursive })
  }

  getVaultState(vaultAddress: string): NonFungibleVaultState | undefined {
    return Object.values(this.values)
      .filter((v): v is Extract<NonFungibleResourceCollectionItem, { aggregationLevel: 'Vault' }> => v.aggregationLevel === 'Vault')
      .flatMap(v => Object.entries(v.vaults))
      .find(([address]) => address === vaultAddress)?.[1]
  }

  async loadValues(
    { aggregationLevel, recursive, ledgerStateSelector }: {
      aggregationLevel?: 'Global' | 'Vault'
      ledgerStateSelector?: LedgerStateSelector
      recursive?: boolean
    },
  ): Promise<void> {
    const result = await this.stateFetcher.stateApi.entityNonFungiblesPage({
      stateEntityNonFungiblesPageRequest: {
        at_ledger_state: this.cursor?.stateVersion ? { state_version: this.cursor?.stateVersion } : ledgerStateSelector,
        aggregation_level: aggregationLevel,
        address: this.entity,
        cursor: this.cursor.cursor,
        opt_ins: {
          non_fungible_include_nfids: true,
        },
      },
    })
    this.stateFetcher.apiCallCount++

    // console.log(result)

    this.parseValues({ non_fungible_resources: result, state_version: result.ledger_state.state_version })

    if (recursive && !!this.cursor.cursor) {
      this.loadValues({ aggregationLevel, recursive: true })
    }
  }

  private parseValues({ non_fungible_resources, state_version }: {
    non_fungible_resources: NonFungibleResourcesCollection | undefined
    state_version: number
  }): void {
    this.cursor = { cursor: non_fungible_resources?.next_cursor, stateVersion: state_version }

    non_fungible_resources?.items.forEach((item) => {
      const resourceAddress = item.resource_address

      if (item.aggregation_level === 'Vault') {
        if (this.values[resourceAddress] === undefined) {
          this.values[resourceAddress] = {
            totalCount: 0,
            ids: [],
            aggregationLevel: 'Vault',
            vaults: {},
          }
        }

        const value = this.values[resourceAddress]

        if (value.aggregationLevel !== 'Vault') {
          throw new Error(`Invalid aggregation level: ${value.aggregationLevel}`)
        }

        item.vaults.items.forEach((vault) => {
          const totalCount = vault.items?.length ?? 0

          if (totalCount !== 0) {
            value.totalCount = value.totalCount + totalCount

            value.ids = value.ids!.concat(vault.items ?? [])

            value.vaults![vault.vault_address] = {
              resourceAddress,
              totalCount,
              ids: vault.items ?? [],
            }
          }
        })

        if (value.totalCount === 0) {
          delete this.values[resourceAddress]
        }
        else {
          this.values[resourceAddress] = value
        }
      }
      else {
        if (item.amount !== 0) {
          this.values[resourceAddress] = {
            aggregationLevel: 'Global',
            totalCount: item.amount,
          }
        }
      }
    })
  }
}
