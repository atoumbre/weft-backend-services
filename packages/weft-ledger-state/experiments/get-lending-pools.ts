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

  const AllIds = await WeftLedgerSateFetcher.setInstance(gatewayApiClient).getPoolInfos()

  // console.log(AllIds)

  // eslint-disable-next-line no-console
  console.log(AllIds)
})()
