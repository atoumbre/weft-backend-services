import type Decimal from 'decimal.js'
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { beforeEach, describe, expect, it } from 'bun:test'
import { KeyValueStore } from '../src/owned-entity/key-value-store'
import EntityStateFetcher from '../src/state-fetcher'
import { dec } from '../src/utils'

describe('KeyValueStore', () => {
  let kvStore: KeyValueStore<string, { cachedValue: Decimal, timestamp: number }>
  let stateFetcher: EntityStateFetcher
  let ledgerState: { state_version: number }

  let XRD: string
  let xUSDC: string
  let xUSDT: string

  beforeEach(() => {
    const gatewayApiClient = GatewayApiClient.initialize({
      basePath: 'https://mainnet.radixdlt.com',
      applicationName: 'Weft API',
      headers: {
        'User-Agent': 'WeftFinance',
      },
    })

    XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    xUSDC = 'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'
    xUSDT = 'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw'

    ledgerState = { state_version: 173919702 }
    stateFetcher = new EntityStateFetcher(gatewayApiClient)
    kvStore = new KeyValueStore<string, { cachedValue: Decimal, timestamp: number }>('internal_keyvaluestore_rdx1krnvw2lrk6jdhemskgsjldjahq2aatvycpwuuccaap93880hr2s0dh', stateFetcher)
  })

  it('should initialize correctly and load values', async () => {
    await kvStore.init(ledgerState)

    expect(kvStore.isInitialized).toBe(true)
    expect(kvStore.hasMore).toBe(false)
    expect(kvStore.getValue(XRD)?.cachedValue).toEqual(dec(1))
    expect(kvStore.getValue(xUSDT)?.cachedValue).toEqual(dec('36.656000967055992176'))
    expect(kvStore.getValue(xUSDC)?.cachedValue).toEqual(dec('39.721917429046730056'))
  })

  it('should return default value for missing keys', async () => {
    await kvStore.init()
    expect(kvStore.getValue('nonexistent')).toBeUndefined()
  })

  it('should allow setting a new default value', async () => {
    kvStore.setDefaultValue({ cachedValue: dec(1), timestamp: 0 })
    expect(kvStore.getValue('nonexistent')?.cachedValue).toEqual(dec(1))
    expect(kvStore.getValue('nonexistent')?.timestamp).toBe(0)
  })

  it('should load more values and update cursor', async () => {
    kvStore = new KeyValueStore<string, { cachedValue: Decimal, timestamp: number }>('internal_keyvaluestore_rdx1kzq23k98ex9gxf8jwnlmlpcz290nc87pglt5v8s78d9mh7at607xpw', stateFetcher)
    await kvStore.init({ state_version: 83292084 })
    expect(stateFetcher.apiCallCount).toBe(2)

    await kvStore.loadMore()
    expect(stateFetcher.apiCallCount).toBe(4)
    expect(kvStore.hasMore).toBe(true)

    await kvStore.loadMore()
    expect(stateFetcher.apiCallCount).toBe(6)
    expect(kvStore.hasMore).toBe(true)

    await kvStore.loadMore()
    expect(stateFetcher.apiCallCount).toBe(8)
    expect(kvStore.hasMore).toBe(false)
  })

  it('should increment apiCallCount appropriately', async () => {
    expect(stateFetcher.apiCallCount).toBe(0) // Another 2 calls
    await kvStore.init()
    expect(stateFetcher.apiCallCount).toBe(2) // One for keys, one for data

    await kvStore.loadMore()
    expect(stateFetcher.apiCallCount).toBe(2) // no more calls, already loaded and no more to load
  })
})
