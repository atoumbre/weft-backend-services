import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { beforeEach, describe, expect, test } from 'bun:test'
import { FungibleResourceCollectionState } from '../src/owned-entity/fungible-resource-collection'
import EntityStateFetcher from '../src/state-fetcher'
import { dec } from '../src/utils'

describe('FungibleResourceCollectionState', () => {
  let stateFetcher: EntityStateFetcher
  let ledgerStateSelector: { state_version: number }
  let XRD: string
  let xUSDC: string
  let xUSDT: string

  let state: FungibleResourceCollectionState

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

    ledgerStateSelector = { state_version: 273919702 }
    stateFetcher = new EntityStateFetcher(gatewayApiClient)

    state = new FungibleResourceCollectionState('component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w', stateFetcher)
  })

  test('should initialize and load global resource', async () => {
    expect(state.isInitialized).toBe(false)

    await state.init({ aggregationLevel: 'Global', ledgerStateSelector })

    expect(state.isInitialized).toBe(true)

    dec(0)

    expect(state.values[XRD]?.aggregationLevel).toBe('Global')
    expect(state.values[XRD]?.amount.toString()).toBe('1315296.2244905406833481')

    expect(state.values[xUSDC]?.aggregationLevel).toBe('Global')
    expect(state.values[xUSDC]?.amount.toString()).toBe('101.452291')

    expect(state.values[xUSDT]?.aggregationLevel).toBe('Global')
    expect(state.values[xUSDT]?.amount.toString()).toBe('1221.229058')

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should handle vault aggregation with non-zero amounts', async () => {
    expect(state.isInitialized).toBe(false)

    await state.init({ aggregationLevel: 'Vault', ledgerStateSelector })

    expect(state.isInitialized).toBe(true)

    expect(state.values[XRD]?.aggregationLevel).toBe('Vault')
    expect(state.values[XRD]?.amount.toString()).toBe('1315296.2244905406833481')

    expect(state.values[xUSDC]?.aggregationLevel).toBe('Vault')
    expect(state.values[xUSDC]?.amount.toString()).toBe('101.452291')

    expect(state.values[xUSDT]?.aggregationLevel).toBe('Vault')
    expect(state.values[xUSDT]?.amount.toString()).toBe('1221.229058')

    const xrdVaults = state.values[XRD]?.vaults

    expect(xrdVaults?.internal_vault_rdx1tq47nl4amg77s2jd3pyvr0h2fu8m963jmk8svt79sf4t6ar0tt0wlr?.amount.toString()).toBe('7999.533104840849094771')
    expect(xrdVaults?.internal_vault_rdx1tqf4sk2qcxpffw8tdhcs48j2fwrnnr9qwk3uawwl4cffzn9wac6ze9?.amount.toString()).toBe('1307296.691385699834253329')

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('getVaultState should return correct vault', async () => {
    await state.init({ aggregationLevel: 'Vault', ledgerStateSelector })

    const xrdVault1 = state.getVaultState('internal_vault_rdx1tq47nl4amg77s2jd3pyvr0h2fu8m963jmk8svt79sf4t6ar0tt0wlr')
    expect(xrdVault1?.amount.toString()).toBe('7999.533104840849094771')
    expect(xrdVault1?.resourceAddress).toBe(XRD)

    const xUsdcVault2 = state.getVaultState('internal_vault_rdx1tqf4sk2qcxpffw8tdhcs48j2fwrnnr9qwk3uawwl4cffzn9wac6ze9')
    expect(xUsdcVault2?.amount.toString()).toBe('1307296.691385699834253329')
    expect(xUsdcVault2?.resourceAddress).toBe(XRD)
  })

  test('initWithValues should parse initial values correctly', async () => {
    const result = await stateFetcher.stateApi.stateEntityDetails({
      stateEntityDetailsRequest: {
        at_ledger_state: ledgerStateSelector,
        addresses: ['component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w'],
        aggregation_level: 'Vault',
        opt_ins: {
          non_fungible_include_nfids: true,
          native_resource_details: true,
        },
      },
    })

    const initialValues = { fungible_resources: result.items[0]?.fungible_resources, state_version: result.ledger_state.state_version }

    await state.setInitialValues({ initialValues })

    expect(state.isInitialized).toBe(true)

    expect(state.values[XRD]?.aggregationLevel).toBe('Vault')
    expect(state.values[XRD]?.amount.toString()).toBe('1315296.2244905406833481')

    expect(state.values[xUSDC]?.aggregationLevel).toBe('Vault')
    expect(state.values[xUSDC]?.amount.toString()).toBe('101.452291')

    expect(state.values[xUSDT]?.aggregationLevel).toBe('Vault')
    expect(state.values[xUSDT]?.amount.toString()).toBe('1221.229058')

    expect(stateFetcher.apiCallCount).toBe(0)
  })

  //   test('should not re-add resource if amount is zero in Vault mode', async () => {
  //     const mockData = {
  //       items: [
  //         {
  //           resource_address: 'resource_0',
  //           aggregation_level: 'Vault',
  //           vaults: {
  //             items: [{ vault_address: 'v0', amount: '0' }],
  //           },
  //         },
  //       ],
  //       next_cursor: null,
  //       ledger_state: { state_version: 30 },
  //     }

  //     stateFetcher.stateApi.entityFungiblesPage.mockResolvedValue(mockData)

  //     await state.init({ stateFetcher, aggregationLevel: 'Vault' })
  //     expect(state.values.resource_0).toBeUndefined()
  //   })

  //   test('loadMore should skip if no more pages', async () => {
  //     await state.initWithValues({
  //       initialValues: {
  //         state_version: 1,
  //         fungible_resources: {
  //           items: [makeFungibleItem()],
  //           next_cursor: null,
  //         },
  //       },
  //       stateFetcher,
  //     })

//     await state.loadMore(stateFetcher)
//     expect(stateFetcher.apiCallCount).toBe(0)
//   })
})
