import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import EntityStateFetcher from '../src/state-fetcher'

export declare interface OnchainCollateralInfo {
  amount: number
  config_version: [[number, number], number | undefined]
}

export declare interface OnchainLoanInfo {
  units: number
  config_version: [number, number]
}

export declare interface OnChainNFTCollateralInfo {
  nft_ids: string[]
  config_version: Record<string, [[number, number], number | undefined]>
}

export declare interface OnchainCdpData {
  id: string
  minted_at: number
  updated_at: number
  key_image_url: string
  name: string
  description: string
  collaterals: Record<string, OnchainCollateralInfo>
  loans: Record<string, OnchainLoanInfo>
  nft_collaterals: Record<string, OnChainNFTCollateralInfo>
}

const gatewayApiClient = GatewayApiClient.initialize({
  basePath: 'https://mainnet.radixdlt.com',
  applicationName: 'Weft API',
  headers: {
    'User-Agent': 'WeftFinance',
  },
})
const _stateFetcher = new EntityStateFetcher(gatewayApiClient)

/* spellchecker: disable */

async function test(): Promise<void> {
  // const LENDING_MARKET_PRICE_CACHE_KVS = 'internal_keyvaluestore_rdx1krnvw2lrk6jdhemskgsjldjahq2aatvycpwuuccaap93880hr2s0dh'
  // const LENDING_POOL_INTEREST_STRATEGY_KVS = 'internal_keyvaluestore_rdx1krx5aq2h74pdyj99r3rpztr2ahvd9xdtfcfujrm079zw279sse68ck'
  // const ledgerState = 173919702

  // const kvs = new KeyValueStore<string, any>('internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc')
  // await kvs.init(stateFetcher)

  // console.log(kvs.values.resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd)

  // await stakingpoolstate?.$state.stakingEngine.init(stateFetcher)

  // console.log(Object.keys(stakingpoolstate?.$state.stakingEngine.snapshots.values).length)

  // await stakingpoolstate?.$state.stakingEngine.snapshots.loadMore(stateFetcher)

  // console.log(Object.keys(stakingpoolstate?.$state.stakingEngine.snapshots.values).length)

  // !

  const LENDING_MARKET_COMPONENT = 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w'

  const res = (await _stateFetcher.fetchEntityState([LENDING_MARKET_COMPONENT]))[0]

  // eslint-disable-next-line no-console
  console.log(Object.keys(res?.$fungibleResources.values ?? {}))
  // "resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz"

  // 'internal_vault_rdx1tq2jc7quksny5z7j85t53402z7ymgjc23a56dh4lcrmeurpt5496xf'

  // 'internal_vault_rdx1tz9rkuz00ytgqqgna2mgtuwe8vn4qc6y8cgknm6cj0ks62adv3hq9e'
}

test()
