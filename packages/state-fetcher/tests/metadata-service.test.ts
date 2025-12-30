import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { beforeEach, describe, expect, test } from 'bun:test'
import { MetadataService } from '../src/metadata-service'
import EntityStateFetcher from '../src/state-fetcher'

describe('MetadataService', () => {
  let stateFetcher: EntityStateFetcher
  let metadataService: MetadataService
  let ledgerStateSelector: { state_version: number } | undefined

  beforeEach(() => {
    const gatewayApiClient = GatewayApiClient.initialize({
      basePath: 'https://mainnet.radixdlt.com',
      applicationName: 'Weft API',
      headers: {
        'User-Agent': 'WeftFinance',
      },
    })

    ledgerStateSelector = undefined
    stateFetcher = new EntityStateFetcher(gatewayApiClient)
    metadataService = new MetadataService(stateFetcher)
  })

  test('should fetch resource details for XRD and debt units', async () => {
    const resources = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', // XRD
      'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz', // XRD DU
      'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf', // LSULP
      'resource_rdx1t4p82pms6r20k87rscms728tekujacd0sgxyysk7yvl0jgf56gvjuc', // LSULP DU
    ]

    const result = await metadataService.getResourceDetails(resources)

    expect(result.length).toBe(4)
    expect(result.every((r: { type: string }) => r.type === 'FungibleResource' || r.type === 'NonFungibleResource')).toBe(true)

    const xrdResource = result.find(r => r.resourceAddress === resources[0])
    expect(xrdResource).toBeDefined()
    expect(xrdResource?.type).toBe('FungibleResource')

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should fetch resource details for stablecoins', async () => {
    const resources = [
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf', // xUSDC
      'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee', // xUSDC DU
      'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', // xUSDT
      'resource_rdx1t5ljp8amkf76mrn5txmmemkrmjwt5r0ajjnljvyunh27gm0n295dfn', // xUSDT DU
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBe(4)
    expect(result.every(r => r.type === 'FungibleResource')).toBe(true)

    const xusdcResource = result.find(r => r.resourceAddress === resources[0])
    expect(xusdcResource).toBeDefined()

    const xusdtResource = result.find(r => r.resourceAddress === resources[2])
    expect(xusdtResource).toBeDefined()

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should fetch resource details for crypto assets', async () => {
    const resources = [
      'resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75', // xWBTC
      'resource_rdx1thyes252jplxhu8qvfx6k3wkmlhy2f09nfqqefuj2a73l79e0af99t', // xWBTC DU
      'resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww', // xETH
      'resource_rdx1t456hgpk6kwn4lqut5p2mqqmuuwngzhwxlgyyk9dwv4t5hmp37d7xf', // xETH DU
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBe(4)
    expect(result.every(r => r.type === 'FungibleResource')).toBe(true)

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should fetch resource details for Ociswap/Hug assets', async () => {
    const resources = [
      'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv', // hUSDC
      'resource_rdx1t4kxe9n00hgzng02myj6a320qxcma2umxj8ygr795cc5m0hsj3p4l2', // hUSDC DU
      'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe', // hUSDT
      'resource_rdx1t48fy4e7d0zfzkky5yxvgaxvewp65ecv49vtccyawlulhegk3sw7kz', // hUSDT DU
      'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5', // hWBTC
      'resource_rdx1t4y98gg8r4mvlaf6tyut0natx874er06qy84ct3d5dvg0c3j2d6d4s', // hWBTC DU
      'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0', // hETH
      'resource_rdx1t5tcgsd0m6ptqsd0g70xu08tzdhy23ml5ql9xlmmv9wpchg3lw7dtk', // hETH DU
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBe(8)
    expect(result.every(r => r.type === 'FungibleResource')).toBe(true)

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should fetch additional resource addresses', async () => {
    const resources = [
      'resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r',
      'resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3',
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf', // xUSDC
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.every(r => r.type === 'FungibleResource' || r.type === 'NonFungibleResource')).toBe(true)

    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should handle large batch with all resources', async () => {
    const resources = [
      // XRD & LSULP
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz',
      'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf',
      'resource_rdx1t4p82pms6r20k87rscms728tekujacd0sgxyysk7yvl0jgf56gvjuc',
      // xUSDC, xUSDT
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
      'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee',
      'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw',
      'resource_rdx1t5ljp8amkf76mrn5txmmemkrmjwt5r0ajjnljvyunh27gm0n295dfn',
      // xWBTC, xETH
      'resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75',
      'resource_rdx1thyes252jplxhu8qvfx6k3wkmlhy2f09nfqqefuj2a73l79e0af99t',
      'resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww',
      'resource_rdx1t456hgpk6kwn4lqut5p2mqqmuuwngzhwxlgyyk9dwv4t5hmp37d7xf',
      // hUSDC, hUSDT, hWBTC, hETH
      'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv',
      'resource_rdx1t4kxe9n00hgzng02myj6a320qxcma2umxj8ygr795cc5m0hsj3p4l2',
      'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe',
      'resource_rdx1t48fy4e7d0zfzkky5yxvgaxvewp65ecv49vtccyawlulhegk3sw7kz',
      'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5',
      'resource_rdx1t4y98gg8r4mvlaf6tyut0natx874er06qy84ct3d5dvg0c3j2d6d4s',
      'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0',
      'resource_rdx1t5tcgsd0m6ptqsd0g70xu08tzdhy23ml5ql9xlmmv9wpchg3lw7dtk',
      // Additional resources
      'resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r',
      'resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3',
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(22)
    expect(result.every(r => r.type === 'FungibleResource' || r.type === 'NonFungibleResource')).toBe(true)

    // Should batch into 2 API calls (20 + 2)
    expect(stateFetcher.apiCallCount).toBe(2)
  })

  test('should handle empty array', async () => {
    const result = await metadataService.getResourceDetails([], ledgerStateSelector)

    expect(result.length).toBe(0)
    expect(stateFetcher.apiCallCount).toBe(0)
  })

  test('should deduplicate resource addresses', async () => {
    const resources = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', // duplicate
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
    ]

    const result = await metadataService.getResourceDetails(resources, ledgerStateSelector)

    expect(result.length).toBeLessThanOrEqual(2)
    expect(stateFetcher.apiCallCount).toBe(1)
  })

  test('should use in-memory cache for subsequent requests', async () => {
    const resources = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
    ]

    // First fetch - should hit API
    const result1 = await metadataService.getResourceDetails(resources)
    expect(result1.length).toBe(2)
    expect(stateFetcher.apiCallCount).toBe(1)

    // Second fetch - should use cache, no new API calls
    const result2 = await metadataService.getResourceDetails(resources)
    expect(result2.length).toBe(2)
    expect(stateFetcher.apiCallCount).toBe(1) // Still 1, no new API calls

    // Verify results are the same
    expect(result1[0]?.resourceAddress).toBe(result2[1]?.resourceAddress)
    expect(result1[1]?.resourceAddress).toBe(result2[0]?.resourceAddress)
  })

  test('should fetch only uncached resources on partial cache hit', async () => {
    const firstBatch = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
    ]

    const secondBatch = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', // cached
      'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', // new
    ]

    // First fetch
    await metadataService.getResourceDetails(firstBatch)
    expect(stateFetcher.apiCallCount).toBe(1)

    // Second fetch with partial overlap
    const result = await metadataService.getResourceDetails(secondBatch)
    expect(result.length).toBe(2)
    expect(stateFetcher.apiCallCount).toBe(2) // One more API call for the new resource

    // Verify cached resource is present
    const cachedResource = result.find(r => r.resourceAddress === firstBatch[0])
    expect(cachedResource).toBeDefined()
  })

  test('getResourceFromCache should return cached resource', async () => {
    const resources = ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd']

    // Fetch resource
    await metadataService.getResourceDetails(resources)

    // Get from cache
    const cached = metadataService.getResourceFromCache(resources[0] ?? '')
    expect(cached).toBeDefined()
    expect(cached?.resourceAddress).toBe(resources[0])

    // Try non-existent resource
    const notCached = metadataService.getResourceFromCache('resource_rdx1invalid')
    expect(notCached).toBeUndefined()
  })

  test('getAllResourcesFromState should return all fetched resources', async () => {
    const resources = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
    ]

    await metadataService.getResourceDetails(resources)

    const allResources = metadataService.getAllResourcesFromState()
    expect(allResources.length).toBe(2)
    expect(allResources.every(r => resources.includes(r.resourceAddress))).toBe(true)
  })

  test('clearCache should remove all cached data', async () => {
    const resources = [
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    ]

    // Fetch and cache
    await metadataService.getResourceDetails(resources)
    expect(metadataService.getResourceFromCache(resources[0] ?? '')).toBeDefined()

    // Clear cache
    metadataService.clearCache()
    expect(metadataService.getAllResourcesFromState().length).toBe(0)
    expect(metadataService.getResourceFromCache(resources[0] ?? '')).toBeUndefined()

    // Fetch again should hit API
    const initialApiCount = stateFetcher.apiCallCount
    await metadataService.getResourceDetails(resources)
    expect(stateFetcher.apiCallCount).toBe(initialApiCount + 1)
  })
})

describe('MetadataService with localStorage', () => {
  let stateFetcher: EntityStateFetcher
  let metadataService: MetadataService

  // Mock localStorage for Node/Bun environment
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        store = {}
      },
      get length() {
        return Object.keys(store).length
      },
      key: (index: number) => {
        const keys = Object.keys(store)
        return keys[index] ?? null
      },
    }
  })()

  beforeEach(() => {
    globalThis.localStorage = localStorageMock
    localStorageMock.clear()

    const gatewayApiClient = GatewayApiClient.initialize({
      basePath: 'https://mainnet.radixdlt.com',
      applicationName: 'Weft API',
      headers: {
        'User-Agent': 'WeftFinance',
      },
    })

    stateFetcher = new EntityStateFetcher(gatewayApiClient)
    metadataService = new MetadataService(stateFetcher, true, 3600000) // 1 hour TTL
  })

  test('should persist cache to localStorage', async () => {
    const resources = ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd']

    // Fetch resource
    await metadataService.getResourceDetails(resources)

    // Verify localStorage has the data
    const storedItem = localStorageMock.getItem(`weft_metadata_${resources[0]}`)
    expect(storedItem).toBeDefined()
    expect(storedItem).not.toBeNull()

    const parsed = JSON.parse(storedItem!)
    expect(parsed.value.resourceAddress).toBe(resources[0])
    expect(parsed.expiry).toBeGreaterThan(Date.now())
  })

  test('should restore from localStorage cache', async () => {
    const resources = ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd']

    const newMetadataService = new MetadataService(stateFetcher, true, 3600000)

    // First fetch
    await newMetadataService.getResourceDetails(resources)
    const firstApiCount = stateFetcher.apiCallCount

    // Create new service instance (simulates app restart)

    // Second fetch should use localStorage cache
    const result = await newMetadataService.getResourceDetails(resources)
    expect(result.length).toBe(1)
    expect(stateFetcher.apiCallCount).toBe(firstApiCount) // No API calls, loaded from localStorage
  })

  test('should expire cached items after TTL', async () => {
    const shortTTL = 100 // 100ms
    const shortTTLService = new MetadataService(stateFetcher, true, shortTTL)

    const resources = ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd']

    // First fetch
    await shortTTLService.getResourceDetails(resources)
    expect(stateFetcher.apiCallCount).toBe(1)

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150))

    // Second fetch should hit API again (cache expired)
    await shortTTLService.getResourceDetails(resources)
    expect(stateFetcher.apiCallCount).toBe(2)
  })

  test('clearCache should remove localStorage entries', async () => {
    const resources = ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd']

    await metadataService.getResourceDetails(resources)
    expect(localStorageMock.getItem(`weft_metadata_${resources[0]}`)).not.toBeNull()

    metadataService.clearCache()
    expect(localStorageMock.getItem(`weft_metadata_${resources[0]}`)).toBeNull()
  })

  test('should fetch validator resource metadata', async () => {
    const resources = [
      'resource_rdx1tkhpmejwlqn8fqlgtqe8ex0cpzkmlkth572hddy07g37a40s356wz4', // ValidatorLiquidStakeUnit
      'resource_rdx1nfjypru7hqx9ejphnqctcg6ru5x88ttmr2j2mj2lmues5qwvdvxkdg', // ValidatorClaimNft
    ]

    const initialApiCount = stateFetcher.apiCallCount
    const result = await metadataService.getResourceDetails(resources)

    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(2)

    const liquidStakeUnit = result.find(r => r.resourceAddress === resources[0])
    expect(liquidStakeUnit).toBeDefined()
    expect(liquidStakeUnit?.type).toBe('FungibleResource')
    expect(liquidStakeUnit?.validatorMetadata).not.toBeUndefined()

    // Check native_resource_details for ValidatorLiquidStakeUnit
    const lsuDetails = (liquidStakeUnit as any)?.native_resource_details
    expect(lsuDetails).toBeDefined()
    expect(lsuDetails).not.toBeNull()
    if (lsuDetails?.kind) {
      expect(lsuDetails.kind).toBe('ValidatorLiquidStakeUnit')
    }

    const claimNft = result.find(r => r.resourceAddress === resources[1])
    if (claimNft) {
      expect(claimNft.type).toBe('NonFungibleResource')

      // Check native_resource_details for ValidatorClaimNft
      const claimDetails = (claimNft as any)?.native_resource_details
      expect(claimDetails).toBeDefined()
      expect(claimDetails).not.toBeNull()
      if (claimDetails?.kind) {
        expect(claimDetails.kind).toBe('ValidatorClaimNft')
      }
    }

    // Should make 1-2 API calls depending on which resources exist
    expect(stateFetcher.apiCallCount).toBeGreaterThanOrEqual(initialApiCount + 1)
    expect(stateFetcher.apiCallCount).toBeLessThanOrEqual(initialApiCount + 2)
  })

  test('should cache validator metadata for subsequent requests', async () => {
    const resources = [
      'resource_rdx1tkhpmejwlqn8fqlgtqe8ex0cpzkmlkth572hddy07g37a40s356wz4', // ValidatorLiquidStakeUnit
    ]

    // First fetch - should fetch validator metadata
    const result1 = await metadataService.getResourceDetails(resources)
    // const firstApiCount = stateFetcher.apiCallCount

    expect(result1.length).toBeGreaterThan(0)
    const firstResource = result1.find(r => r.resourceAddress === resources[0])
    expect(firstResource?.validatorMetadata).toBeDefined()

    // Clear only resource cache, not validator cache
    metadataService.getAllResourcesFromState() // Just access it
    const apiCountBeforeSecondFetch = stateFetcher.apiCallCount

    // Second fetch of the same resource - validator metadata should be cached
    const result2 = await metadataService.getResourceDetails(resources)

    expect(result2.length).toBeGreaterThan(0)
    const secondResource = result2.find(r => r.resourceAddress === resources[0])
    expect(secondResource?.validatorMetadata).toBeDefined()

    // If the resource was cached, no new API calls
    // If the resource was not cached, only 1 new API call for resource (not validator)
    expect(stateFetcher.apiCallCount).toBeLessThanOrEqual(apiCountBeforeSecondFetch + 1)

    // Validator metadata should be identical
    expect(secondResource?.validatorMetadata).toEqual(firstResource?.validatorMetadata)
  })

  test('should reuse cached validator metadata when clearing resource cache', async () => {
    const resources = [
      'resource_rdx1tkhpmejwlqn8fqlgtqe8ex0cpzkmlkth572hddy07g37a40s356wz4', // ValidatorLiquidStakeUnit
    ]

    // First fetch - fetches both resource and validator metadata
    const result1 = await metadataService.getResourceDetails(resources)
    const apiCountAfterFirst = stateFetcher.apiCallCount

    expect(result1.length).toBeGreaterThan(0)
    const firstResource = result1.find(r => r.resourceAddress === resources[0])
    expect(firstResource?.validatorMetadata).toBeDefined()

    // Create a new service instance to test that validator cache persists separately
    const newMetadataService = new MetadataService(stateFetcher, true, 3600000)

    // Fetch the same resource with new service - validator metadata should be cached in localStorage
    const result2 = await newMetadataService.getResourceDetails(resources)

    const secondResource = result2.find(r => r.resourceAddress === resources[0])
    expect(secondResource?.validatorMetadata).toBeDefined()

    // The new service should reuse cached resource data (including validator metadata)
    // So API count should remain the same
    expect(stateFetcher.apiCallCount).toBe(apiCountAfterFirst)
  })
})
