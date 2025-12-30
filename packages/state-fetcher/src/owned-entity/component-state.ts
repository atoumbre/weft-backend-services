import type { LedgerStateSelector, ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk'
import type EntityStateFetcher from '../state-fetcher'

export class ComponentState<T = any> {
  entity: string
  stateFetcher: EntityStateFetcher
  state: T | undefined
  initialized: boolean = false

  constructor(entity: string, stateFetcher: EntityStateFetcher) {
    this.entity = entity
    this.stateFetcher = stateFetcher
  }

  async init(ledgerStateSelector?: LedgerStateSelector): Promise<void> {
    const result = await this.stateFetcher.stateApi.stateEntityDetails({
      stateEntityDetailsRequest: {
        at_ledger_state: ledgerStateSelector,
        addresses: [this.entity],
      },
    })
    this.stateFetcher.apiCallCount++

    if (result.items.length === 0)
      return

    const details = result.items[0]?.details

    if (details?.type !== 'Component')
      return

    const rawState = details.state as ProgrammaticScryptoSborValue

    if (!rawState)
      return

    const value = await this.stateFetcher.fetchField(rawState)

    this.state = value as T
  }
}
