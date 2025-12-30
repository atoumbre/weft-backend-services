import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { WeftLedgerSateFetcher } from '../src/api'

(async () => {
  const gatewayApiClient = GatewayApiClient.initialize({
    basePath: 'https://mainnet.radixdlt.com',
    applicationName: 'Weft API',
    headers: {
      'User-Agent': 'WeftFinance',
    },
  })

  const AllIds = await WeftLedgerSateFetcher.setInstance(gatewayApiClient).getCdpIds()

  const ids = AllIds.map(a => a.non_fungible_id)

  // eslint-disable-next-line no-console
  console.log(AllIds.length)

  // eslint-disable-next-line no-console
  const list = await WeftLedgerSateFetcher.getInstance().getMultipleCdp(ids, { onProgress: console.log })// .then(res => console.error(res))

  // eslint-disable-next-line no-console
  console.log(list.data.length, list.failedIds.length)
})()
