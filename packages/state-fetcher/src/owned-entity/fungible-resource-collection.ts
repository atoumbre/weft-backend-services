import type { FungibleResourcesCollection, LedgerStateSelector } from '@radixdlt/babylon-gateway-api-sdk'
import type Decimal from 'decimal.js'
import type EntityStateFetcher from '../state-fetcher'
import type { FungibleResourceState } from '../types'
import { dec } from '../utils'

export interface FungibleVaultState {
  resourceAddress: string
  amount: Decimal
}

export type FungibleResourceCollectionItem = {
  amount: Decimal
  fungibleDetails?: FungibleResourceState
} & (
  | { aggregationLevel: 'Global' }
  | { aggregationLevel: 'Vault', vaults: Record<string, FungibleVaultState> }
)

export class FungibleResourceCollectionState {
  entity: string
  values: Record<string, FungibleResourceCollectionItem> = {} as Record<string, FungibleResourceCollectionItem>

  private initialized = false
  private stateFetcher: EntityStateFetcher
  private cursor: { cursor: string | null | undefined, stateVersion: number }

  constructor(entity: string, stateFetcher: EntityStateFetcher) {
    this.entity = entity
    this.stateFetcher = stateFetcher
    this.cursor = { cursor: undefined, stateVersion: 0 }
  };

  get hasMore(): boolean {
    return !!this.cursor?.cursor
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  private reset(): void {
    this.values = {} as Record<string, FungibleResourceCollectionItem>
    this.cursor = { cursor: undefined, stateVersion: 0 }
    this.initialized = false
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

  setInitialValues({ initialValues }: {
    initialValues: { fungible_resources: FungibleResourcesCollection | undefined, state_version: number }
  }): void {
    this.reset()

    if (initialValues.fungible_resources) {
      this.parseValues(initialValues)
    }

    this.initialized = true
  }

  async loadMore(recursive: boolean = false): Promise<void> {
    if (!this.hasMore)
      return
    await this.loadValues({ recursive })
  }

  getVaultState(vaultAddress: string): FungibleVaultState | undefined {
    return Object.values(this.values)
      .filter((v): v is Extract<FungibleResourceCollectionItem, { aggregationLevel: 'Vault' }> => v.aggregationLevel === 'Vault')
      .flatMap(v => Object.entries(v.vaults))
      .find(([address]) => address === vaultAddress)?.[1]
  }

  private async loadValues(
    { aggregationLevel, recursive, ledgerStateSelector }: {
      aggregationLevel?: 'Global' | 'Vault'
      ledgerStateSelector?: LedgerStateSelector
      recursive?: boolean
    },
  ): Promise<void> {
    const result = await this.stateFetcher.stateApi.entityFungiblesPage({
      stateEntityFungiblesPageRequest: {
        at_ledger_state: this.cursor?.stateVersion ? { state_version: this.cursor?.stateVersion } : ledgerStateSelector,
        address: this.entity,
        aggregation_level: aggregationLevel,
        cursor: this.cursor?.cursor,
      },
    })
    this.stateFetcher.apiCallCount++

    this.parseValues({ fungible_resources: result, state_version: result.ledger_state.state_version })

    if (recursive && !!this.cursor.cursor) {
      this.loadValues({ aggregationLevel, recursive: true })
    }
  }

  private parseValues({ fungible_resources, state_version }: {
    fungible_resources: FungibleResourcesCollection | undefined
    state_version: number
  }): void {
    this.cursor = { cursor: fungible_resources?.next_cursor, stateVersion: state_version }

    fungible_resources?.items.forEach((item) => {
      const resourceAddress = item.resource_address

      if (item.aggregation_level === 'Vault') {
        if (this.values[resourceAddress] === undefined) {
          this.values[resourceAddress] = {
            amount: dec(0),
            aggregationLevel: 'Vault',
            vaults: {},
          }
        }

        const value = this.values[resourceAddress]

        if (value.aggregationLevel !== 'Vault') {
          throw new Error(`Invalid aggregation level: ${value.aggregationLevel}`)
        }

        item.vaults.items.forEach((vault) => {
          const amount = dec(vault.amount)

          value.amount = value.amount.add(amount)

          value.vaults![vault.vault_address] = {
            resourceAddress,
            amount,
          }
        })

        this.values[resourceAddress] = value
      }
      else {
        // if (this.values[resourceAddress]?.amount.isZero()) {
        //   return
        // }

        this.values[resourceAddress] = {
          amount: dec(item.amount),
          aggregationLevel: 'Global',
        }
      }
    })
  }
}
