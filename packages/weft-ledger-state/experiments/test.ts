import type { CommittedTransactionInfo, ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk'
import type Decimal from 'decimal.js'
import type { ResourcePoolState } from '../src/types/lending-pool'
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { KeyValueStore } from '../../state-fetcher/src/owned-entity/key-value-store'
import EntityStateFetcher from '../../state-fetcher/src/state-fetcher'
import { dec } from '../../state-fetcher/src/utils'

export const resourceToDuMapping = new Map<string, { interestModel: string, du: string }>([
  ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', { interestModel: '1', du: 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz' }], // XRD
  ['resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf', { interestModel: '0', du: 'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee' }], // xUSDC
  ['resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', { interestModel: '0', du: 'resource_rdx1t5ljp8amkf76mrn5txmmemkrmjwt5r0ajjnljvyunh27gm0n295dfn' }], // xUSDT
  ['resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75', { interestModel: '2', du: 'resource_rdx1thyes252jplxhu8qvfx6k3wkmlhy2f09nfqqefuj2a73l79e0af99t' }], // xwBTC
  ['resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww', { interestModel: '2', du: 'resource_rdx1t456hgpk6kwn4lqut5p2mqqmuuwngzhwxlgyyk9dwv4t5hmp37d7xf' }], // xETH
])

export const duToResourceMapping = new Map([...resourceToDuMapping].map(([k, v]) => [v.du, k]))

const gatewayApiClient = GatewayApiClient.initialize({
  basePath: 'https://mainnet.radixdlt.com',
  applicationName: 'Weft API',
  headers: {
    'User-Agent': 'WeftFinance',
  },
})
const stateFetcher = new EntityStateFetcher(gatewayApiClient)

async function test(): Promise<void> {
  const LENDING_MARKET_COMPONENT = 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w'
  const WEFTY_V2 = 'resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r'

  // const ACCOUNT = 'account_rdx16yrue2ar9645q3wpcd9sahc9dxsmtf2rq8tuc49q9h7j9g84xwh07e'
  const ACCOUNT = 'account_rdx16y4jfcu7ncfycf3hx2qe52g3zfguvjzm2rn5c0ntf0m7zpfaych2fr'
  // const ACCOUNT = 'account_rdx1688dxj6a8x25aqsahl8luv8tpdzrc5wtfh9eee9f89sm6pujg4yvvf'
  // const TRACKED_DU = 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz'
  // const TRACKED_DU = 'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee'

  const history: {
    tx: string
    state_version: number
    entity: string
    duResAddress: string
    duAmount: Decimal
    amount: Decimal
    unitRatio: Decimal
    tag: string
  }[] = []

  // ! PROCESS COLLATERAL EVENTS

  let cursor
  let state_version

  let totalAdd = dec(0)
  let totalRemove = dec(0)

  do {
    const res1 = await stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
      streamTransactionsRequest: {
        cursor,
        at_ledger_state: state_version ? { state_version } : undefined,
        affected_global_entities_filter: [
          ACCOUNT,
          LENDING_MARKET_COMPONENT,
        ],
        // balance_change_resources_filter: [
        // ],
        opt_ins: {
          // balance_changes: true,
          // affected_global_entities: true,
          detailed_events: true,
        },
      },
    })

    cursor = res1.next_cursor
    state_version = res1.ledger_state.state_version

    // console.log(res1.next_cursor)

    await Promise.all(res1.items.map(async (tx) => {
      const kvs = new KeyValueStore<string, ResourcePoolState>('internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc')
      await kvs.init(stateFetcher, { state_version: tx.state_version })

      // const affectedAccount = tx.affected_global_entities?.filter(entity => entity.includes('account')).length ?? 0

      // if (affectedAccount > 1) {
      // console.log('Multiple affected accounts', tx.intent_hash)

      // scan events

      const events: Record<string, { eventType: string, resAddress: string, amount: Decimal }> = {}

      tx.receipt?.detailed_events?.forEach((event) => {
        // console.log('eventType', event.identifier.event)
        if (event.identifier.event.includes('Collateral')) {
          const eventType = (event.payload.programmatic_json as any).type_name
          const rawEventData = (event.payload.programmatic_json as any).fields[0] as ProgrammaticScryptoSborValue
          const eventData = stateFetcher.fetchField(rawEventData) as { cdpId: string, resAddress: string, amount: Decimal }

          if (!duToResourceMapping.get(eventData.resAddress))
            return

          // console.log('eventType', eventType)

          events[eventData.cdpId] = { eventType, resAddress: eventData.resAddress, amount: eventData.amount,
          }
        }
      })

      // locate NFT ids

      if (Object.keys(events).length === 0)
        return

      const locationRes = await stateFetcher.gatewayApi.state.innerClient.nonFungibleLocation({
        stateNonFungibleLocationRequest: {
          at_ledger_state: { state_version: tx.state_version },
          resource_address: WEFTY_V2,
          non_fungible_ids: Object.keys(events),
        },
      })

      locationRes.non_fungible_ids.forEach((item) => {
        if (item.is_burned)
          return

        //     console.log(item.non_fungible_id, item.owning_vault_global_ancestor_address)

        const duAmount = events[item.non_fungible_id]?.amount ?? dec(0)
        if (duAmount.isZero())
          return

        if (!duToResourceMapping.get(events[item.non_fungible_id]?.resAddress ?? ''))
          return

        const unitRatio = kvs.values[duToResourceMapping.get(events[item.non_fungible_id]?.resAddress ?? '') ?? '']?.depositState.unitRatio ?? dec(1)

        if (events[item.non_fungible_id]?.eventType === 'AddCollateralEvent' && item.owning_vault_global_ancestor_address === ACCOUNT) {
          if (events[item.non_fungible_id]?.resAddress === 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz')
            totalAdd = totalAdd.add(duAmount)

          history.push({
            tx: tx.intent_hash!,
            state_version: tx.state_version,
            entity: item.owning_vault_global_ancestor_address!,
            duResAddress: events[item.non_fungible_id]?.resAddress ?? '',
            duAmount,
            amount: duAmount.div(unitRatio).neg(),
            unitRatio,
            tag: `${events[item.non_fungible_id]?.eventType}|${item.non_fungible_id}`,
          })
        }
        else if (events[item.non_fungible_id]?.eventType === 'RemoveCollateralEvent' && item.owning_vault_global_ancestor_address === ACCOUNT) {
          if (events[item.non_fungible_id]?.resAddress === 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz')
            totalRemove = totalRemove.add(duAmount)

          history.push({
            tx: tx.intent_hash!,
            state_version: tx.state_version,
            entity: item.owning_vault_global_ancestor_address!,
            duResAddress: events[item.non_fungible_id]?.resAddress ?? '',
            duAmount: duAmount.neg(),
            amount: duAmount.div(unitRatio),
            unitRatio,
            tag: `${events[item.non_fungible_id]?.eventType}|${item.non_fungible_id}`,
          })
        }
      })
    }))
  } while (cursor)

  // console.log('totalAdd', totalAdd)
  // console.log('totalRemove', totalRemove)

  // const balances1: Record<string, { duAmount: Decimal, amount: Decimal }> = {}

  // history.forEach((h) => {
  //   if (balances1[h.duResAddress] === undefined) {
  //     balances1[h.duResAddress] = { duAmount: dec(0), amount: dec(0) }
  //   }

  //   balances1[h.duResAddress]!.amount = balances1[h.duResAddress]!.amount.add(h.amount)
  //   balances1[h.duResAddress]!.duAmount = balances1[h.duResAddress]!.duAmount.add(h.duAmount)

  //   console.log(h.amount, h.duAmount, balances1[h.duResAddress]?.duAmount, balances1[h.duResAddress]?.amount)
  // })

  // console.log(balances1, history.length)

  // for (const h of history) {
  //   console.log(h)
  // }

  // ! PROCESS NFT TRANSFERS

  const res2 = await stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
    streamTransactionsRequest: {
      affected_global_entities_filter: [
        ACCOUNT,
      ],
      balance_change_resources_filter: [
        WEFTY_V2,
      ],
      opt_ins: {
        balance_changes: true,
      },
    },
  })
  // console.log(res2.next_cursor)

  totalAdd = dec(0)
  totalRemove = dec(0)

  await Promise.all(res2.items.map(async (tx) => {
    const kvs = new KeyValueStore<string, ResourcePoolState>('internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc')

    await kvs.init(stateFetcher, { state_version: tx.state_version })

    const balanceChange: Record<string, { origine: string, destination: string }> = {}

    tx?.balance_changes?.non_fungible_balance_changes.forEach((balance_change) => {
      if (balance_change.resource_address === WEFTY_V2) {
        balance_change.added.forEach((nft) => {
          if (balanceChange[nft] === undefined) {
            balanceChange[nft] = { origine: '', destination: '' }
          }

          balanceChange[nft].destination = balance_change.entity_address
        })

        balance_change.removed.forEach((nft) => {
          if (balanceChange[nft] === undefined) {
            balanceChange[nft] = { origine: '', destination: '' }
          }

          balanceChange[nft].origine = balance_change.entity_address
        })
      }
    })

    const ids: string[] = Object.entries(balanceChange).filter(([_, value]) => value.destination !== '' && value.origine !== '').map(([id, _]) => id)

    if (ids.length > 0) {
      const res3 = await stateFetcher.fetchNftData<OnLedgerCdpData>(
        WEFTY_V2,
        ids,
        { ledgerStateSelector: { state_version: tx.state_version } },
      )

      res3.forEach((nft) => {
        Object.keys(nft.$data?.collaterals ?? {}).forEach((resAddress) => {
          if (duToResourceMapping.get(resAddress)) {
            const unitRatio = kvs.values[duToResourceMapping.get(resAddress) ?? '']?.depositState.unitRatio ?? dec(1)

            const amount = dec(nft.$data?.collaterals[resAddress]?.amount ?? 0)

            if (balanceChange[nft.$nonFungibleId]!.destination === ACCOUNT) {
              if (resAddress === 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz')
                totalAdd = totalAdd.add(amount)

              history.push({
                tx: tx.intent_hash!,
                state_version: tx.state_version,
                entity: balanceChange[nft.$nonFungibleId]!.destination,
                duResAddress: resAddress,
                duAmount: amount,
                amount: amount.div(unitRatio).neg(),
                unitRatio,
                tag: `${nft.$nonFungibleId}TransferIn`,
              })
            }

            if (balanceChange[nft.$nonFungibleId]!.origine === ACCOUNT) {
              if (resAddress === 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz')
                totalRemove = totalRemove.add(amount)

              history.push({
                tx: tx.intent_hash!,
                state_version: tx.state_version,
                entity: balanceChange[nft.$nonFungibleId]!.origine,
                duResAddress: resAddress,
                duAmount: amount.neg(),
                amount: amount.div(unitRatio),
                unitRatio,
                tag: `${nft.$nonFungibleId}TransferOut`,
              })
            }
          }
        })
      })
    }
  }))

  // console.log('totalAdd', totalAdd)
  // console.log('totalRemove', totalRemove)

  // ! PROCESS DU BALANCE CHANGES

  const res3 = await Promise.all([...duToResourceMapping.keys()].map (async resAddress => stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
    streamTransactionsRequest: {
      affected_global_entities_filter: [
        ACCOUNT,
      ],
      balance_change_resources_filter: [
        resAddress,
      ],
      opt_ins: {
        balance_changes: true,
        affected_global_entities: true,
        detailed_events: true,
      },
    },
  })))

  const dedupTx: Record<string, CommittedTransactionInfo> = {}

  res3.forEach((res) => {
    // console.log(res.next_cursor)
    res.items.forEach((item) => {
      if (dedupTx[item.intent_hash!] === undefined) {
        dedupTx[item.intent_hash!] = item
      }
    })
  })

  await Promise.all(Object.values(dedupTx).map(async (tx) => {
    const kvs = new KeyValueStore<string, ResourcePoolState>('internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc')

    await kvs.init(stateFetcher, { state_version: tx.state_version })

    tx?.balance_changes?.fungible_balance_changes.forEach((balance_change) => {
      if (duToResourceMapping.has(balance_change.resource_address) && balance_change.entity_address === ACCOUNT) {
        const unitRatio = kvs.values[duToResourceMapping.get(balance_change.resource_address)!]!.depositState.unitRatio

        history.push({
          tx: tx.intent_hash!,
          state_version: tx.state_version,
          duResAddress: balance_change.resource_address,
          unitRatio,
          duAmount: dec(balance_change.balance_change),
          amount: dec(balance_change.balance_change).div(unitRatio).neg(),
          entity: balance_change.entity_address,
          tag: 'du_balance_change',
        })
      }
    })

    // tx.receipt?.detailed_events?.forEach((event) => {
    //   if (event.emitter.type === 'EntityMethod' && duToResourceMapping.has(event.emitter.global_emitter)) {
    //     const unitRatio = kvs.values[duToResourceMapping.get(event.emitter.global_emitter)!]!.depositState.unitRatio

    //     if (event.identifier.event.includes('Burn') && event.emitter.type === 'EntityMethod' && duToResourceMapping.has(event.emitter.global_emitter)) {
    //       const rawEventData = (event.payload.programmatic_json as any).fields[0] as ProgrammaticScryptoSborValue
    //       const amount = stateFetcher.fetchField(rawEventData) as Decimal

    //       history.push({
    //         tx: tx.intent_hash!,
    //         state_version: tx.state_version,
    //         duResAddress: event.emitter.global_emitter,
    //         unitRatio,
    //         duAmount: dec(0), // amount.neg(),
    //         amount: amount.div(unitRatio),
    //         entity: ACCOUNT,
    //         tag: 'du_burn',
    //       })
    //     }

    //     if (event.identifier.event.includes('Mint') && event.emitter.type === 'EntityMethod' && duToResourceMapping.has(event.emitter.global_emitter)) {
    //       const rawEventData = (event.payload.programmatic_json as any).fields[0] as ProgrammaticScryptoSborValue
    //       const amount = stateFetcher.fetchField(rawEventData) as Decimal

    //       history.push({
    //         tx: tx.intent_hash!,
    //         state_version: tx.state_version,
    //         duResAddress: event.emitter.global_emitter,
    //         unitRatio,
    //         duAmount: dec(0),
    //         amount: amount.div(unitRatio).neg(),
    //         entity: ACCOUNT,
    //         tag: 'du_mint',
    //       })
    //     }
    //   }
    // })
  }))

  // !

  history.sort((a, b) => a.state_version - b.state_version)

  // for (const h of history) {
  //   console.log(h)
  // }

  // ! Current balances

  const kvs = new KeyValueStore<string, ResourcePoolState>('internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc')
  await kvs.init(stateFetcher)

  const res4 = await stateFetcher.fetchEntityState([ACCOUNT], { skipState: true })

  const accountCurrentDuAmounts: Record<string, Decimal> = {}

  duToResourceMapping.forEach((_, key) => {
    accountCurrentDuAmounts[key] = res4[0]?.$fungibleResources.values[key]?.amount ?? dec(0)
  })

  const weftyCurrentDuAmounts: Record<string, Decimal> = {}

  const currentWefties = res4[0]!.$nonFungibleResources.values[WEFTY_V2]!.ids ?? []

  if (currentWefties.length > 0) {
    const res5 = await stateFetcher.fetchNftData<OnLedgerCdpData>(
      WEFTY_V2,
      currentWefties,
    )

    res5.forEach((nft) => {
      Object.keys(nft.$data?.collaterals ?? {}).forEach((resAddress) => {
        if (duToResourceMapping.get(resAddress)) {
          weftyCurrentDuAmounts[resAddress] = (weftyCurrentDuAmounts[resAddress] ?? dec(0)).add(dec(nft.$data?.collaterals[resAddress]?.amount ?? 0))
        }
      })
    })
  }

  const currentDuAmounts: Record<string, { duAmount: Decimal, amount: Decimal }> = {}

  Object.entries(accountCurrentDuAmounts).forEach(([key, duAmount]) => {
    if (currentDuAmounts[key] === undefined) {
      currentDuAmounts[key] = { duAmount: dec(0), amount: dec(0) }
    }

    const unitRation = kvs.values[duToResourceMapping.get(key) ?? '']?.depositState.unitRatio ?? dec(1)

    currentDuAmounts[key].amount = currentDuAmounts[key].amount.add(duAmount.div(unitRation))
    currentDuAmounts[key].duAmount = currentDuAmounts[key].duAmount.add(duAmount)
  })

  Object.entries(weftyCurrentDuAmounts).forEach(([key, duAmount]) => {
    if (currentDuAmounts[key] === undefined) {
      currentDuAmounts[key] = { duAmount: dec(0), amount: dec(0) }
    }

    const unitRation = kvs.values[duToResourceMapping.get(key) ?? '']?.depositState.unitRatio ?? dec(1)

    currentDuAmounts[key].amount = currentDuAmounts[key].amount.add(duAmount.div(unitRation))
    currentDuAmounts[key].duAmount = currentDuAmounts[key].duAmount.add(duAmount)
  })

  const balances: Record<string, { duAmount: Decimal, amount: Decimal }> = {}

  history.forEach((h) => {
    if (balances[h.duResAddress] === undefined) {
      balances[h.duResAddress] = { duAmount: dec(0), amount: dec(0) }
    }

    balances[h.duResAddress]!.amount = balances[h.duResAddress]!.amount.add(h.amount)
    balances[h.duResAddress]!.duAmount = balances[h.duResAddress]!.duAmount.add(h.duAmount)
  })

  // console.log(balances)

  // console.log(currentDuAmounts)
}

test()
