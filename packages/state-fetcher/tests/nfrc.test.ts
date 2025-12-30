import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { beforeEach, describe, expect, test } from 'bun:test'
import { NonFungibleResourceCollectionState } from '../src/owned-entity/non-fungible-resource-collection'
import EntityStateFetcher from '../src/state-fetcher'

describe('FungibleResourceCollectionState', () => {
  let stateFetcher: EntityStateFetcher
  let ledgerStateSelector: { state_version: number }
  let resource1: string
  let resource2: string
  let resource3: string

  let state: NonFungibleResourceCollectionState

  beforeEach(() => {
    const gatewayApiClient = GatewayApiClient.initialize({
      basePath: 'https://mainnet.radixdlt.com',
      applicationName: 'Weft API',
      headers: {
        'User-Agent': 'WeftFinance',
      },
    })

    resource1 = 'resource_rdx1ntzkvzevv8xsp2ayaxy6euqyqflm9w76h5le2g9096ywxcgz5q7z5x'
    resource2 = 'resource_rdx1nfuf2z370tt7nr6gpjje60tq9zdksj0lgwmpcfdchkscnha0422dfp'
    resource3 = 'resource_rdx1nfjypru7hqx9ejphnqctcg6ru5x88ttmr2j2mj2lmues5qwvdvxkdg'

    ledgerStateSelector = { state_version: 273919702 }
    stateFetcher = new EntityStateFetcher(gatewayApiClient)

    state = new NonFungibleResourceCollectionState('component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w', stateFetcher)
  })

  test('should initialize and load global resource', async () => {
    expect(state.isInitialized).toBe(false)

    await state.init({ aggregationLevel: 'Global', ledgerStateSelector })

    expect(state.isInitialized).toBe(true)

    expect(state.values[resource1]?.aggregationLevel).toBe('Global')
    expect(state.values[resource1]?.totalCount).toBe(56)

    expect(state.values[resource2]?.aggregationLevel).toBe('Global')
    expect(state.values[resource2]?.totalCount).toBe(27)

    expect(state.values[resource3]?.aggregationLevel).toBe('Global')
    expect(state.values[resource3]?.totalCount).toBe(15)

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should handle vault aggregation with non-zero amounts', async () => {
    expect(state.isInitialized).toBe(false)

    await state.init({ aggregationLevel: 'Vault', ledgerStateSelector })

    expect(state.isInitialized).toBe(true)

    expect(state.values[resource1]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource1]?.totalCount).toBe(56)

    expect(state.values[resource2]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource2]?.totalCount).toBe(27)

    expect(state.values[resource3]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource3]?.totalCount).toBe(15)

    const xrdVaults = state.values[resource1]?.vaults

    expect(xrdVaults?.internal_vault_rdx1nrkc907xg660syhkxpvf3eyh7n935nyrrwczl9p8ackk6xsaxw9sk3?.totalCount).toBe(56)

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('getVaultState should return correct vault', async () => {
    await state.init({ aggregationLevel: 'Vault', ledgerStateSelector })

    const xrdVault1 = state.getVaultState('internal_vault_rdx1nrkc907xg660syhkxpvf3eyh7n935nyrrwczl9p8ackk6xsaxw9sk3')
    expect(xrdVault1?.totalCount).toBe(56)
    expect(xrdVault1?.resourceAddress).toBe(resource1)

    const xUsdcVault2 = state.getVaultState('internal_vault_rdx1npwmmjd5ya5pp0hea77halks43fctgd8vtcvgelwn49d470nmmckhw')
    expect(xUsdcVault2?.totalCount).toBe(15)
    expect(xUsdcVault2?.resourceAddress).toBe(resource3)
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

    const initialValues = { non_fungible_resources: result.items[0]?.non_fungible_resources, state_version: result.ledger_state.state_version }

    await state.setInitialValues({ initialValues })

    expect(state.isInitialized).toBe(true)

    expect(state.values[resource1]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource1]?.totalCount).toBe(56)

    expect(state.values[resource2]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource2]?.totalCount).toBe(27)

    expect(state.values[resource3]?.aggregationLevel).toBe('Vault')
    expect(state.values[resource3]?.totalCount).toBe(15)

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
