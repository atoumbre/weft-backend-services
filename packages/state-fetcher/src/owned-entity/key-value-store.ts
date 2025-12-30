import type { LedgerStateSelector, ScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk'
import type EntityStateFetcher from '../state-fetcher'

function defaultKeyParser<K>(entryKey: ScryptoSborValue, stateFetcher: EntityStateFetcher): K {
  const res = stateFetcher.fetchField(entryKey.programmatic_json)
  return res as K
}

function defaultValueParser<V>(entryValue: ScryptoSborValue, stateFetcher: EntityStateFetcher): V {
  const res = stateFetcher.fetchField(entryValue.programmatic_json)
  return res as V
}

export class KeyValueStore<K extends string, V = any> {
  values: Record<K, V> = {} as Record<K, V>

  get hasMore(): boolean {
    return !!this.cursor?.cursor
  }

  get isInitialized(): boolean {
    return this.initialized
  }

  private storeAddress: string
  private initialized = false
  private defaultValue?: V
  private stateFetcher: EntityStateFetcher
  private cursor: { cursor: string | null | undefined, stateVersion: number }

  constructor(
    storeAddress: string,
    stateFetcher: EntityStateFetcher,
    defaultValue?: V,
  ) {
    this.storeAddress = storeAddress
    this.stateFetcher = stateFetcher
    this.defaultValue = defaultValue
    this.cursor = { cursor: undefined, stateVersion: 0 }
  };

  async init(ledgerStateSelector?: LedgerStateSelector): Promise<void> {
    this.values = {} as Record<K, V>
    this.cursor = { cursor: undefined, stateVersion: 0 }
    await this.loadValues(ledgerStateSelector)
    this.initialized = true
  }

  async loadMore(): Promise<void> {
    if (!this.hasMore)
      return
    await this.loadValues()
  }

  getValue(key: K): V | undefined {
    return this.values[key] ?? this.defaultValue
  }

  setDefaultValue(value: V): void {
    this.defaultValue = value
  }

  private async loadValues(ledgerStateSelector?: LedgerStateSelector): Promise<void> {
    const at_ledger_state = ledgerStateSelector || (this.cursor?.stateVersion ? { state_version: this.cursor?.stateVersion } : ledgerStateSelector)

    const response = await this.stateFetcher.stateApi.keyValueStoreKeys({
      stateKeyValueStoreKeysRequest: {
        key_value_store_address: this.storeAddress,
        cursor: this.cursor?.cursor,
        at_ledger_state,
      },
    })
    this.stateFetcher.apiCallCount++

    this.cursor = {
      cursor: response.next_cursor,
      stateVersion: response.ledger_state.state_version,
    }

    const keys = response.items.map(item => item.key.raw_hex)

    if (keys.length > 0) {
      const response = await this.stateFetcher.stateApi.keyValueStoreData({
        stateKeyValueStoreDataRequest: {
          at_ledger_state,
          key_value_store_address: this.storeAddress,
          keys: keys.map((key) => {
            return { key_hex: key }
          }),
        },
      })
      this.stateFetcher.apiCallCount++

      const tasks = response.entries.map(async (entry) => {
        const [parsed_key, parsed_value] = await Promise.all([
          defaultKeyParser<K>(entry.key, this.stateFetcher),
          defaultValueParser<V>(entry.value, this.stateFetcher),
        ])

        this.values[parsed_key] = parsed_value
      })

      await Promise.all(tasks)
    }
  }
}
