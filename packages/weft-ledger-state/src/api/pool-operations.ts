import type { LedgerStateSelector, TransactionPreviewResponse } from '@radixdlt/babylon-gateway-api-sdk'
import type { OperatingStatusValue } from '../types/common'
import type { LendingService, ResourcePoolConfig, ResourcePoolState } from '../types/lending-pool'
import type { ReturnedResourcePoolState } from '../types/return-types'
import type { WeftLedgerStateClient } from './base-client'
import { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'
import { dec } from '../../../state-fetcher/src/utils'
import { defaultLendingPools, LENDING_POOL_COMPONENT, LENDING_POOL_RESOURCE_POOL_KVS, LENDING_POOL_SERVICE_KVS, PROTOCOL_INTEREST_SHARE, resourceToDuMapping } from '../lib/const'
import { createBaseTransactionParams } from '../lib/transaction-utils'

export class PoolOperations {
  constructor(private client: WeftLedgerStateClient) {}

  async getPoolInfos(ledgerStateSelector?: LedgerStateSelector): Promise<{
    pools: ReturnedResourcePoolState[]
    globalLendingService: Record<LendingService, OperatingStatusValue>
  }> {
    const lendingServiceKVS = new KeyValueStore<string, Record<LendingService, OperatingStatusValue>>(LENDING_POOL_SERVICE_KVS, this.client.getFetcher())

    const [res] = await Promise.all([
      ledgerStateSelector
        ? this.getResourcePoolAtLedgerState(ledgerStateSelector)
        : this.getResourcePoolLive(),
      lendingServiceKVS.init(ledgerStateSelector),
    ])

    res.forEach((poolState, index) => {
      const serviceStatus = lendingServiceKVS.getValue(`Resource_${poolState.resourceAddress}`)
      if (serviceStatus) {
        res[index]!.serviceStatus = serviceStatus
      }
    })

    return { pools: res, globalLendingService: lendingServiceKVS.getValue('Global')! }
  }

  private async getResourcePoolAtLedgerState(ledgerStateSelector?: LedgerStateSelector): Promise<ReturnedResourcePoolState[]> {
    const kvs = new KeyValueStore<string, ResourcePoolState>(LENDING_POOL_RESOURCE_POOL_KVS, this.client.getFetcher())

    await kvs.init(ledgerStateSelector)

    const results: ReturnedResourcePoolState[] = Object.entries(kvs.values)?.map(([res, pooState]) => {
      const totalLoan = pooState.loanState.total
      const loanUnitRatio = pooState.loanState.unitRatio
      const totalDeposit = pooState.depositState.total
      const depositUnitRatio = pooState.depositState.unitRatio

      const borrowingApr = dec(pooState.interestRate)

      const rawLendingApr = borrowingApr.mul(totalLoan).div(totalDeposit)
      const netLendingApr = rawLendingApr.mul(dec(1).sub(PROTOCOL_INTEREST_SHARE))

      const interestModelId: string = resourceToDuMapping.get(res)?.interestModel ?? '0'

      const remap: ReturnedResourcePoolState = {
        resourceAddress: res,
        depositUnitAddress: resourceToDuMapping.get(res)!.du,
        totalDeposit,
        totalLoan,
        utilizationRate: totalLoan.div(totalDeposit),
        borrowingApr,
        rawLendingApr,
        netLendingApr,
        depositUnitRatio,
        depositUnitPrice: dec(1).div(depositUnitRatio),
        loanUnitRatio,
        loanUnitPrice: dec(1).div(loanUnitRatio),
        interestModelId,
        config: pooState.poolConfig,
        serviceStatus: undefined,
      }

      return remap
    })

    return results
  }

  private async getResourcePoolLive(resources: string[] | undefined = defaultLendingPools): Promise<ReturnedResourcePoolState[]> {
    const resInput = resources.map(o => `Address("${o}")`).join(',')

    const manifest = `
    CALL_METHOD Address("${LENDING_POOL_COMPONENT}") "get_pool_state" Array<Address>(${resInput});

    CALL_METHOD Address("${LENDING_POOL_COMPONENT}") "get_pool_config" Array<Address>(${resInput});

    `

    const res: TransactionPreviewResponse = await
    this.client.getGatewayApi().transaction.innerClient.transactionPreview({
      transactionPreviewRequest: { ...createBaseTransactionParams(), manifest },
    })

    if ((res.receipt as any).status !== 'Succeeded') {
      throw new Error((res.receipt as any).error_message)
    }

    const stateOutput: any[] = (res.receipt as any).output[0].programmatic_json.entries
    const configOutput: any[] = (res.receipt as any).output[1].programmatic_json.entries

    const result: Record<string, { state: any, config: any }> = {}

    if (!stateOutput || !configOutput) {
      throw new Error('Failed to retrieve state')
    }

    for (let i = 0; i < stateOutput.length; i++) {
      const state = stateOutput[i]

      if (state.value.variant_id === 0) {
        continue
      }

      if (!result[state.key.value]) {
        result[state.key.value] = {
          state: {},
          config: {},
        }
      }

      const res = state.key.value

      result[res]!.state = state.value.fields[0]
    }

    for (let i = 0; i < configOutput.length; i++) {
      const config = configOutput[i]

      if (config.key.variant_id === 0) {
        continue
      }

      if (!result[config.key.value]) {
        result[config.key.value] = {
          state: {},
          config: {},
        }
      }

      const res = config.key.value

      result[res]!.config = config.value.fields[0]
    }

    const pools: ReturnedResourcePoolState[] = []

    for (const [res, { state, config }] of Object.entries(result)) {
      // Config

      const poolConfig: ResourcePoolConfig = {
        interestUpdatePeriod: config.fields[0].value,
        loanFeeRate: config.fields[1].value,
        flashLoanFeeRate: config.fields[2].value,
        depositLimit: config.fields[3].variant_id === '0'
          ? { variantName: 'None' }
          : config.fields[3].variant_id === '1'
            ? { variantName: 'Amount', value: config.fields[3].fields[0].value }
            : { variantName: 'SupplyRatio', value: config.fields[3].fields[0].value },
        utilizationLimit: config.fields[4].variant_id === '0'
          ? undefined
          : config.fields[4].fields[0].value,
        flashLoanAmountLimit: config.fields[5].variant_id === '0'
          ? { variantName: 'None' }
          : config.fields[5].variant_id === '1'
            ? { variantName: 'Amount', value: config.fields[5].fields[0].value }
            : { variantName: 'SupplyRatio', value: config.fields[5].fields[0].value },
      }

      // State

      const totalLoan = dec(state.fields[2].fields[1].value)
      const loanUnitRatio = dec(state.fields[2].fields[3].value)
      const totalDeposit = dec(state.fields[1].fields[1].value)
      const depositUnitRatio = dec(state.fields[1].fields[3].value)

      const borrowingApr = dec(state.fields[0].value)

      const rawLendingApr = borrowingApr.mul(totalLoan).div(totalDeposit)
      const netLendingApr = rawLendingApr.mul(dec(1).sub(PROTOCOL_INTEREST_SHARE))

      // interest model :

      const interestModelId: string = resourceToDuMapping.get(res)?.interestModel ?? '0'

      pools.push({
        resourceAddress: res,
        depositUnitAddress: resourceToDuMapping.get(res)!.du,
        totalDeposit,
        totalLoan,
        utilizationRate: totalLoan.div(totalDeposit),
        borrowingApr,
        rawLendingApr,
        netLendingApr,
        depositUnitRatio,
        depositUnitPrice: dec(1).div(depositUnitRatio),
        loanUnitRatio,
        loanUnitPrice: dec(1).div(loanUnitRatio),
        interestModelId,
        config: poolConfig,
      })
    }

    return pools
  }
}
