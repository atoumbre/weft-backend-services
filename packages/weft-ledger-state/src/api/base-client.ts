import type { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { GatewayApiClient as GatewayClient } from '@radixdlt/babylon-gateway-api-sdk'
import EntityStateFetcher from '../../../state-fetcher/src/state-fetcher'
import { configAndServiceKeyPlugin, servicePlugin, serviceStatusStrategyPlugin } from '../lib/fetcher-plugins'

export class WeftLedgerStateClient {
  private static instance: WeftLedgerStateClient

  private constructor(
    private radixGatewayApi: GatewayApiClient,
    private stateFetcher: EntityStateFetcher,
  ) {}

  static setInstance(radixGatewayApi?: GatewayApiClient): WeftLedgerStateClient {
    if (!this.instance) {
      const defaultApi = radixGatewayApi ?? GatewayClient.initialize({
        basePath: 'https://mainnet.radixdlt.com',
        applicationName: 'Weft API',
      })

      const stateFetcher = new EntityStateFetcher(defaultApi)
      stateFetcher.addPlugins({
        tuplePlugins: [serviceStatusStrategyPlugin],
        enumPlugins: [configAndServiceKeyPlugin, servicePlugin],
      })

      this.instance = new WeftLedgerStateClient(defaultApi, stateFetcher)
    }

    return this.instance
  }

  static getInstance(): WeftLedgerStateClient {
    if (!this.instance) {
      throw new Error('WeftRadixApiService not instantiated')
    }

    return this.instance
  }

  getFetcher(): EntityStateFetcher {
    return this.stateFetcher
  }

  getGatewayApi(): GatewayApiClient {
    return this.radixGatewayApi
  }
}
