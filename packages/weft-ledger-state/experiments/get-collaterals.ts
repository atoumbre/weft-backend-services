import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { WeftLedgerSateFetcher } from '../src/api'
import { LENDING_MARKET_COMPONENT } from '../src/lib/const'

(async () => {
  const gatewayApiClient = GatewayApiClient.initialize({
    basePath: 'https://mainnet.radixdlt.com',
    applicationName: 'Weft API',
    headers: {
      'User-Agent': 'WeftFinance',
    },
  })

  const AllIds = await WeftLedgerSateFetcher.setInstance(gatewayApiClient).getMarketInfos()

  // console.log(AllIds)

  // eslint-disable-next-line no-console
  console.log(AllIds.collateralResources.find(a => a.resourceAddress === 'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0'))

  const res = await WeftLedgerSateFetcher.setInstance(gatewayApiClient).getResourceInfos([LENDING_MARKET_COMPONENT])

  // eslint-disable-next-line no-console
  console.log(res)
})()
