import type { StateNonFungibleLocationResponseItem, TransactionPreviewResponse } from '@radixdlt/babylon-gateway-api-sdk'
import type { CollateralizeDebtPositionData } from '../types/cdp'
import type { FetchResult } from '../types/return-types'
import type { WeftLedgerStateClient } from './base-client'
import { decodeCDP } from '../lib/cdp-decoder'
import { CDP_RESOURCE, LENDING_MARKET_COMPONENT } from '../lib/const'
import { createBaseTransactionParams } from '../lib/transaction-utils'

export class CdpOperations {
  constructor(private client: WeftLedgerStateClient) {}

  async getMultipleCdp(ids: string[], options: { cdpPerBatch?: number, onProgress?: (fetched: number) => void } = {}): Promise<FetchResult> {
    const result = await this.cdpRecursiveIndexer(ids, async (ids: string[]) => this.getCdpDataInternal(ids, options))

    return result
  }

  async getSingleCdp(id: string, preManifest: string): Promise<CollateralizeDebtPositionData> {
    const manifest = `
    ${preManifest}
    CALL_METHOD Address("${LENDING_MARKET_COMPONENT}") "get_cdp" Array<NonFungibleLocalId>(NonFungibleLocalId("${id}"));

    `

    const response: TransactionPreviewResponse = await
    this.client.getGatewayApi().transaction.innerClient.transactionPreview({
      transactionPreviewRequest: { ...createBaseTransactionParams(), manifest },
    })

    if ((response.receipt as any).status !== 'Succeeded') {
      throw new Error((response.receipt as any).error_message)
    }

    const outputs = (response.receipt as any).output as any[]

    const receipt = outputs[outputs.length - 1].programmatic_json.entries[0]
    const cdp: CollateralizeDebtPositionData = decodeCDP(receipt.key.value, receipt.value.fields)

    return cdp
  }

  async getCdpIds(returnBurntTokens: boolean = false): Promise<StateNonFungibleLocationResponseItem[]> {
    let nonFungibleLocalIds: StateNonFungibleLocationResponseItem[] = []
    let nextCursor: string | null | undefined
    let at_ledger_state

    do {
      const res = await this.client.getGatewayApi().state.innerClient.nonFungibleIds({
        stateNonFungibleIdsRequest: {
          resource_address: CDP_RESOURCE,
          cursor: nextCursor,
          at_ledger_state: at_ledger_state === undefined
            ? null
            : {
                state_version: at_ledger_state,
              },
        },
      })

      const locationRes = await this.client.getGatewayApi().state.innerClient.nonFungibleLocation({
        stateNonFungibleLocationRequest: {
          resource_address: CDP_RESOURCE,
          non_fungible_ids: res.non_fungible_ids.items,
        },
      })

      nonFungibleLocalIds = nonFungibleLocalIds.concat(
        locationRes.non_fungible_ids.filter(item => item.is_burned === returnBurntTokens),
      )

      nextCursor = res.non_fungible_ids.next_cursor
      at_ledger_state = res.ledger_state.state_version
    } while (nextCursor)

    return nonFungibleLocalIds
  }

  private async getCdpDataInternal(ids: string[], options: { cdpPerBatch?: number, onProgress?: (fetched: number) => void } = { }): Promise<CollateralizeDebtPositionData[]> {
    const batchedIds: string[][] = []
    const cdpPerBatch = options.cdpPerBatch ?? 10

    for (let i = 0; i < ids.length; i += cdpPerBatch) {
      batchedIds.push(ids.slice(i, i + cdpPerBatch).map(id => `NonFungibleLocalId("${id}")`))
    }

    const cdps: CollateralizeDebtPositionData[] = []

    const manifests = batchedIds.map(
      batchedId => `CALL_METHOD Address("${LENDING_MARKET_COMPONENT}") "get_cdp" Array<NonFungibleLocalId>(${batchedId.join(',')});

`,
    )

    const response: TransactionPreviewResponse[] = await Promise.all(manifests.map(manifest =>
      this.client.getGatewayApi().transaction.innerClient.transactionPreview({
        transactionPreviewRequest: { ...createBaseTransactionParams(), manifest },
      }),
    ))

    const receipts = response
      .map((r) => {
        if ((r.receipt as any).status !== 'Succeeded') {
          throw new Error((r.receipt as any).error_message)
        }

        return (r.receipt as any).output[0].programmatic_json.entries
      })
      .flat()

    receipts.forEach((r) => {
      cdps.push(decodeCDP(r.key.value, r.value.fields))
    })

    if (options.onProgress)
      options.onProgress(cdps.length)

    return cdps
  }

  private async cdpRecursiveIndexer(
    ids: string[],
    fetchData: (ids: string[]) => Promise<CollateralizeDebtPositionData[]>,
  ): Promise<FetchResult> {
    if (ids.length === 0)
      return { data: [], failedIds: [] }

    try {
      const data = await fetchData(ids)
      return { data, failedIds: [] }
    }
    catch {
      if (ids.length === 1) {
        return { data: [], failedIds: ids }
      }

      const mid = Math.floor(ids.length / 2)

      const [left, right] = await Promise.all([
        this.cdpRecursiveIndexer(ids.slice(0, mid), fetchData),
        this.cdpRecursiveIndexer(ids.slice(mid), fetchData),
      ])

      const data = [...left.data, ...right.data]

      return {
        data,
        failedIds: [...left.failedIds, ...right.failedIds],
      }
    }
  }
}
