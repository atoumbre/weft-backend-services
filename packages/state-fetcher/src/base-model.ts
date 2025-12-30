import type { LedgerStateSelector } from '@radixdlt/babylon-gateway-api-sdk'
import type { BaseEntityState, BaseNonFungibleData, ResourceState } from './types'
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import EntityStateFetcher from './state-fetcher'

export class BaseModel {
  protected stateFetcher: EntityStateFetcher

  constructor(stateFetcher?: EntityStateFetcher) {
    this.stateFetcher = stateFetcher ?? new EntityStateFetcher(GatewayApiClient.initialize({
      basePath: 'https://mainnet.radixdlt.com',
      applicationName: 'Weft State Fetcher',
      headers: {
        'User-Agent': 'WeftFinance',
      },
    }))
  }
}

export class EntityStateModel<T = any> extends BaseModel {
  innerState: BaseEntityState<T>
  initialized: boolean = false

  constructor(entityAddress: string, stateFetcher?: EntityStateFetcher) {
    super(stateFetcher)
    this.innerState = EntityStateFetcher.newBaseState<T>(entityAddress, this.stateFetcher)
  }

  async init(): Promise<void> {
    if (!this.innerState.$entityAddress)
      return
    this.innerState = (await this.stateFetcher.fetchEntityState([this.innerState.$entityAddress]))[0]!
  }

  get state(): T {
    return this.innerState.$state!
  }
}

export class NonFungibleDataModel<T = any> extends BaseModel {
  innerData: BaseNonFungibleData<T>
  initialized: boolean = false

  constructor(entityAddress: string, nonFungibleId: string, stateFetcher?: EntityStateFetcher) {
    super(stateFetcher)

    this.innerData = {
      $entityAddress: entityAddress,
      $nonFungibleId: nonFungibleId,
      $data: undefined,
    }
  }

  async init(): Promise<void> {
    if (!this.innerData.$entityAddress)
      return
    this.innerData = (await this.stateFetcher.fetchNftData<T>(this.innerData.$entityAddress, [this.innerData.$nonFungibleId]))[0]!
  }

  get data(): T {
    return this.innerData.$data!
  }
}

export class ResourceDetailsRepo extends BaseModel {
  ledgerStateSelector?: LedgerStateSelector

  resources: Record<string, ResourceState> = {}

  constructor(stateFetcher?: EntityStateFetcher, ledgerStateSelector?: LedgerStateSelector) {
    super(stateFetcher)

    this.ledgerStateSelector = ledgerStateSelector
  }

  async fetchResourceState(entityAddressesInput: string[]): Promise<void> {
    const addresses = entityAddressesInput.filter(address => this.resources[address] === undefined)

    if (addresses.length > 1) {
      const res = await this.stateFetcher.fetchResourceState(entityAddressesInput, { ledgerStateSelector: this.ledgerStateSelector })
      res.forEach((resourceDetails) => {
        this.resources[resourceDetails.$entityAddress] = resourceDetails
      })
    }
  }
}
