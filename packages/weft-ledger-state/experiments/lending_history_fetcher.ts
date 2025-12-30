// import type { CommittedTransactionInfo, ProgrammaticScryptoSborValue } from '@radixdlt/babylon-gateway-api-sdk'
// import type Decimal from 'decimal.js'
// import type { ResourcePoolState } from '../src/types/lending-pool'
// import type { OnchainCdpData } from '../src/types/onchain-cdp'
// import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
// import { KeyValueStore } from '../../state-fetcher/src/owned-entity/key-value-store'
// import EntityStateFetcher from '../../state-fetcher/src/state-fetcher'
// import { dec, pdec } from '../../state-fetcher/src/utils'

// export interface HistoryEntry {
//   tx: string
//   state_version: number
//   entity: string
//   duResAddress: string
//   duAmount: Decimal
//   amount: Decimal
//   unitRatio: Decimal
//   tag: string
// }

// export interface BalanceSummary {
//   duAmount: Decimal
//   amount: Decimal
// }

// export interface LendingHistoryResult {
//   history: HistoryEntry[]
//   currentBalances: Record<string, BalanceSummary>
//   calculatedBalances: Record<string, BalanceSummary>
// }

// export interface LendingHistoryConfig {
//   gatewayUrl?: string
//   applicationName?: string
//   userAgent?: string
//   lendingMarketComponent?: string
//   weftyV2Resource?: string
//   poolStateKvStore?: string
//   concurrencyLimit?: number
// }

// export class LendingHistoryFetcher {
//   private readonly resourceToDuMapping = new Map<string, { interestModel: string, du: string }>([
//     ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', { interestModel: '1', du: 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz' }], // XRD
//     ['resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf', { interestModel: '0', du: 'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee' }], // xUSDC
//     ['resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', { interestModel: '0', du: 'resource_rdx1t5ljp8amkf76mrn5txmmemkrmjwt5r0ajjnljvyunh27gm0n295dfn' }], // xUSDT
//     ['resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75', { interestModel: '2', du: 'resource_rdx1thyes252jplxhu8qvfx6k3wkmlhy2f09nfqqefuj2a73l79e0af99t' }], // xwBTC
//     ['resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww', { interestModel: '2', du: 'resource_rdx1t456hgpk6kwn4lqut5p2mqqmuuwngzhwxlgyyk9dwv4t5hmp37d7xf' }], // xETH
//   ])

//   private readonly duToResourceMapping = new Map([...this.resourceToDuMapping].map(([k, v]) => [v.du, k]))

//   private readonly gatewayApiClient: GatewayApiClient
//   private readonly stateFetcher: EntityStateFetcher
//   private readonly config: Required<LendingHistoryConfig>

//   // Cache for KVS to avoid repeated fetches
//   private kvsCache = new Map<number, KeyValueStore<string, ResourcePoolState>>()

//   constructor(config: LendingHistoryConfig = {}) {
//     this.config = {
//       gatewayUrl: config.gatewayUrl ?? 'https://mainnet.radixdlt.com',
//       applicationName: config.applicationName ?? 'Weft API',
//       userAgent: config.userAgent ?? 'WeftFinance',
//       lendingMarketComponent: config.lendingMarketComponent ?? 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w',
//       weftyV2Resource: config.weftyV2Resource ?? 'resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r',
//       poolStateKvStore: config.poolStateKvStore ?? 'internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc',
//       concurrencyLimit: config.concurrencyLimit ?? 10,
//     }

//     this.gatewayApiClient = GatewayApiClient.initialize({
//       basePath: this.config.gatewayUrl,
//       applicationName: this.config.applicationName,
//       headers: {
//         'User-Agent': this.config.userAgent,
//       },
//     })

//     this.stateFetcher = new EntityStateFetcher(this.gatewayApiClient)
//   }

//   async fetchAccountHistory(accountAddress: string): Promise<LendingHistoryResult> {
//     const history: HistoryEntry[] = []

//     // Process all three types of events in parallel
//     const [collateralHistory, transferHistory, duBalanceHistory] = await Promise.all([
//       this.processCollateralEvents(accountAddress),
//       this.processNftTransfers(accountAddress),
//       this.processDuBalanceChanges(accountAddress),
//     ])

//     history.push(...collateralHistory, ...transferHistory, ...duBalanceHistory)

//     // Sort by state version
//     history.sort((a, b) => a.state_version - b.state_version)

//     // Fetch current balances in parallel with history processing
//     const currentBalances = await this.fetchCurrentBalances(accountAddress)
//     const calculatedBalances = this.calculateBalancesFromHistory(history)

//     return {
//       history,
//       currentBalances,
//       calculatedBalances,
//     }
//   }

//   private async getKvs(stateVersion: number): Promise<KeyValueStore<string, ResourcePoolState>> {
//     if (this.kvsCache.has(stateVersion)) {
//       return this.kvsCache.get(stateVersion)!
//     }

//     const kvs = new KeyValueStore<string, ResourcePoolState>(this.config.poolStateKvStore)
//     await kvs.init(this.stateFetcher, { state_version: stateVersion })

//     // Cache the KVS but limit cache size to prevent memory issues
//     if (this.kvsCache.size > 100) {
//       const oldestKey = this.kvsCache.keys().next().value
//       this.kvsCache.delete(oldestKey)
//     }

//     this.kvsCache.set(stateVersion, kvs)
//     return kvs
//   }

//   private async processCollateralEvents(accountAddress: string): Promise<HistoryEntry[]> {
//     const history: HistoryEntry[] = []
//     let cursor: string | undefined
//     let stateVersion: number | undefined

//     do {
//       const res = await this.stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
//         streamTransactionsRequest: {
//           cursor,
//           at_ledger_state: stateVersion ? { state_version: stateVersion } : undefined,
//           affected_global_entities_filter: [accountAddress, this.config.lendingMarketComponent],
//           opt_ins: {
//             detailed_events: true,
//           },
//         },
//       })

//       cursor = res.next_cursor
//       stateVersion = res.ledger_state.state_version

//       // Process transactions in parallel with concurrency limit
//       await this.processConcurrently(res.items, async (tx) => {
//         const entries = await this.processCollateralTransaction(tx, accountAddress)
//         history.push(...entries)
//       })
//     } while (cursor)

//     return history
//   }

//   private async processCollateralTransaction(
//     tx: CommittedTransactionInfo,
//     accountAddress: string
//   ): Promise<HistoryEntry[]> {
//     const kvs = await this.getKvs(tx.state_version)
//     const events: Record<string, { eventType: string, resAddress: string, amount: Decimal }> = {}

//     // Extract collateral events
//     tx.receipt?.detailed_events?.forEach((event) => {
//       if (event.identifier.event.includes('Collateral')) {
//         const eventType = (event.payload.programmatic_json as any).type_name
//         const rawEventData = (event.payload.programmatic_json as any).fields[0] as ProgrammaticScryptoSborValue
//         const eventData = this.stateFetcher.fetchField(rawEventData) as { cdpId: string, resAddress: string, amount: Decimal }

//         if (this.duToResourceMapping.get(eventData.resAddress)) {
//           events[eventData.cdpId] = {
//             eventType,
//             resAddress: eventData.resAddress,
//             amount: eventData.amount,
//           }
//         }
//       }
//     })

//     if (Object.keys(events).length === 0) {
//       return []
//     }

//     // Locate NFT ownership
//     const locationRes = await this.stateFetcher.gatewayApi.state.innerClient.nonFungibleLocation({
//       stateNonFungibleLocationRequest: {
//         at_ledger_state: { state_version: tx.state_version },
//         resource_address: this.config.weftyV2Resource,
//         non_fungible_ids: Object.keys(events),
//       },
//     })

//     const history: HistoryEntry[] = []

//     locationRes.non_fungible_ids.forEach((item) => {
//       if (item.is_burned || !events[item.non_fungible_id]) return

//       const event = events[item.non_fungible_id]
//       const duAmount = event.amount

//       if (duAmount.isZero() || !this.duToResourceMapping.get(event.resAddress)) return

//       const unitRatio = kvs.values[this.duToResourceMapping.get(event.resAddress) ?? '']?.depositState.unitRatio ?? pdec(1)

//       if (event.eventType === 'AddCollateralEvent' && item.owning_vault_global_ancestor_address === accountAddress) {
//         history.push({
//           tx: tx.intent_hash!,
//           state_version: tx.state_version,
//           entity: item.owning_vault_global_ancestor_address!,
//           duResAddress: event.resAddress,
//           duAmount,
//           amount: duAmount.div(unitRatio).neg(),
//           unitRatio,
//           tag: `${event.eventType}|${item.non_fungible_id}`,
//         })
//       } else if (event.eventType === 'RemoveCollateralEvent' && item.owning_vault_global_ancestor_address === accountAddress) {
//         history.push({
//           tx: tx.intent_hash!,
//           state_version: tx.state_version,
//           entity: item.owning_vault_global_ancestor_address!,
//           duResAddress: event.resAddress,
//           duAmount: duAmount.neg(),
//           amount: duAmount.div(unitRatio),
//           unitRatio,
//           tag: `${event.eventType}|${item.non_fungible_id}`,
//         })
//       }
//     })

//     return history
//   }

//   private async processNftTransfers(accountAddress: string): Promise<HistoryEntry[]> {
//     const res = await this.stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
//       streamTransactionsRequest: {
//         affected_global_entities_filter: [accountAddress],
//         balance_change_resources_filter: [this.config.weftyV2Resource],
//         opt_ins: {
//           balance_changes: true,
//         },
//       },
//     })

//     const history: HistoryEntry[] = []

//     await this.processConcurrently(res.items, async (tx) => {
//       const entries = await this.processNftTransferTransaction(tx, accountAddress)
//       history.push(...entries)
//     })

//     return history
//   }

//   private async processNftTransferTransaction(
//     tx: CommittedTransactionInfo,
//     accountAddress: string
//   ): Promise<HistoryEntry[]> {
//     const kvs = await this.getKvs(tx.state_version)
//     const balanceChange: Record<string, { origine: string, destination: string }> = {}

//     tx?.balance_changes?.non_fungible_balance_changes.forEach((balance_change) => {
//       if (balance_change.resource_address === this.config.weftyV2Resource) {
//         balance_change.added.forEach((nft) => {
//           if (!balanceChange[nft]) balanceChange[nft] = { origine: '', destination: '' }
//           balanceChange[nft].destination = balance_change.entity_address
//         })

//         balance_change.removed.forEach((nft) => {
//           if (!balanceChange[nft]) balanceChange[nft] = { origine: '', destination: '' }
//           balanceChange[nft].origine = balance_change.entity_address
//         })
//       }
//     })

//     const ids = Object.entries(balanceChange)
//       .filter(([_, value]) => value.destination && value.origine)
//       .map(([id, _]) => id)

//     if (ids.length === 0) return []

//     const nftData = await this.stateFetcher.fetchNftData<OnchainCdpData>(
//       this.config.weftyV2Resource,
//       ids,
//       { ledgerStateSelector: { state_version: tx.state_version } }
//     )

//     const history: HistoryEntry[] = []

//     nftData.forEach((nft) => {
//       Object.keys(nft.$data?.collaterals ?? {}).forEach((resAddress) => {
//         if (!this.duToResourceMapping.get(resAddress)) return

//         const unitRatio = kvs.values[this.duToResourceMapping.get(resAddress) ?? '']?.depositState.unitRatio ?? dec(1)
//         const amount = dec(nft.$data?.collaterals[resAddress]?.amount ?? 0)
//         const transfer = balanceChange[nft.$nonFungibleId]!

//         if (transfer.destination === accountAddress) {
//           history.push({
//             tx: tx.intent_hash!,
//             state_version: tx.state_version,
//             entity: transfer.destination,
//             duResAddress: resAddress,
//             duAmount: amount,
//             amount: amount.div(unitRatio).neg(),
//             unitRatio,
//             tag: `${nft.$nonFungibleId}TransferIn`,
//           })
//         }

//         if (transfer.origine === accountAddress) {
//           history.push({
//             tx: tx.intent_hash!,
//             state_version: tx.state_version,
//             entity: transfer.origine,
//             duResAddress: resAddress,
//             duAmount: amount.neg(),
//             amount: amount.div(unitRatio),
//             unitRatio,
//             tag: `${nft.$nonFungibleId}TransferOut`,
//           })
//         }
//       })
//     })

//     return history
//   }

//   private async processDuBalanceChanges(accountAddress: string): Promise<HistoryEntry[]> {
//     // Fetch transactions for all DU resources in parallel
//     const duResources = [...this.duToResourceMapping.keys()]
//     const streamPromises = duResources.map(resAddress =>
//       this.stateFetcher.gatewayApi.stream.innerClient.streamTransactions({
//         streamTransactionsRequest: {
//           affected_global_entities_filter: [accountAddress],
//           balance_change_resources_filter: [resAddress],
//           opt_ins: {
//             balance_changes: true,
//             affected_global_entities: true,
//             detailed_events: true,
//           },
//         },
//       })
//     )

//     const results = await Promise.all(streamPromises)

//     // Deduplicate transactions
//     const dedupTx: Record<string, CommittedTransactionInfo> = {}
//     results.forEach((res) => {
//       res.items.forEach((item) => {
//         if (!dedupTx[item.intent_hash!]) {
//           dedupTx[item.intent_hash!] = item
//         }
//       })
//     })

//     const history: HistoryEntry[] = []

//     await this.processConcurrently(Object.values(dedupTx), async (tx) => {
//       const entries = await this.processDuBalanceTransaction(tx, accountAddress)
//       history.push(...entries)
//     })

//     return history
//   }

//   private async processDuBalanceTransaction(
//     tx: CommittedTransactionInfo,
//     accountAddress: string
//   ): Promise<HistoryEntry[]> {
//     const kvs = await this.getKvs(tx.state_version)
//     const history: HistoryEntry[] = []

//     tx?.balance_changes?.fungible_balance_changes.forEach((balance_change) => {
//       if (this.duToResourceMapping.has(balance_change.resource_address) &&
//           balance_change.entity_address === accountAddress) {

//         const unitRatio = kvs.values[this.duToResourceMapping.get(balance_change.resource_address)!]!.depositState.unitRatio

//         history.push({
//           tx: tx.intent_hash!,
//           state_version: tx.state_version,
//           duResAddress: balance_change.resource_address,
//           unitRatio,
//           duAmount: dec(balance_change.balance_change),
//           amount: dec(balance_change.balance_change).div(unitRatio).neg(),
//           entity: balance_change.entity_address,
//           tag: 'du_balance_change',
//         })
//       }
//     })

//     return history
//   }

//   private async fetchCurrentBalances(accountAddress: string): Promise<Record<string, BalanceSummary>> {
//     const kvs = await this.getKvs(0) // Latest state

//     // Fetch account state and current Wefty NFTs in parallel
//     const [accountState, ] = await Promise.all([
//       this.stateFetcher.fetchEntityState([accountAddress], { skipState: true }),
//     ])

//     const accountCurrentDuAmounts: Record<string, Decimal> = {}
//     this.duToResourceMapping.forEach((_, key) => {
//       accountCurrentDuAmounts[key] = accountState[0]?.$fungibleResources.values[key]?.amount ?? dec(0)
//     })

//     const weftyCurrentDuAmounts: Record<string, Decimal> = {}
//     const currentWefties = accountState[0]!.$nonFungibleResources.values[this.config.weftyV2Resource]?.ids ?? []

//     if (currentWefties.length > 0) {
//       const nftData = await this.stateFetcher.fetchNftData<OnchainCdpData>(
//         this.config.weftyV2Resource,
//         currentWefties
//       )

//       nftData.forEach((nft) => {
//         Object.keys(nft.$data?.collaterals ?? {}).forEach((resAddress) => {
//           if (this.duToResourceMapping.get(resAddress)) {
//             weftyCurrentDuAmounts[resAddress] = (weftyCurrentDuAmounts[resAddress] ?? dec(0))
//               .add(dec(nft.$data?.collaterals[resAddress]?.amount ?? 0))
//           }
//         })
//       })
//     }

//     const currentDuAmounts: Record<string, BalanceSummary> = {}

//     // Combine account and Wefty balances
//     const allDuAmounts = { ...accountCurrentDuAmounts }
//     Object.entries(weftyCurrentDuAmounts).forEach(([key, amount]) => {
//       allDuAmounts[key] = (allDuAmounts[key] ?? dec(0)).add(amount)
//     })

//     Object.entries(allDuAmounts).forEach(([key, duAmount]) => {
//       const unitRatio = kvs.values[this.duToResourceMapping.get(key) ?? '']?.depositState.unitRatio ?? dec(1)
//       currentDuAmounts[key] = {
//         duAmount,
//         amount: duAmount.div(unitRatio),
//       }
//     })

//     return currentDuAmounts
//   }

//   private calculateBalancesFromHistory(history: HistoryEntry[]): Record<string, BalanceSummary> {
//     const balances: Record<string, BalanceSummary> = {}

//     history.forEach((h) => {
//       if (!balances[h.duResAddress]) {
//         balances[h.duResAddress] = { duAmount: dec(0), amount: dec(0) }
//       }

//       balances[h.duResAddress].amount = balances[h.duResAddress].amount.add(h.amount)
//       balances[h.duResAddress].duAmount = balances[h.duResAddress].duAmount.add(h.duAmount)
//     })

//     return balances
//   }

//   private async processConcurrently<T>(
//     items: T[],
//     processor: (item: T) => Promise<void>,
//   ): Promise<void> {
//     const semaphore = new Semaphore(this.config.concurrencyLimit)

//     await Promise.all(
//       items.map(async (item) => {
//         await semaphore.acquire()
//         try {
//           await processor(item)
//         } finally {
//           semaphore.release()
//         }
//       })
//     )
//   }

//   // Utility methods
//   getResourceToDuMapping(): Map<string, { interestModel: string, du: string }> {
//     return new Map(this.resourceToDuMapping)
//   }

//   getDuToResourceMapping(): Map<string, string> {
//     return new Map(this.duToResourceMapping)
//   }

//   clearCache(): void {
//     this.kvsCache.clear()
//   }
// }

// // Simple semaphore implementation for concurrency control
// class Semaphore {
//   private permits: number
//   private waiting: (() => void)[] = []

//   constructor(permits: number) {
//     this.permits = permits
//   }

//   async acquire(): Promise<void> {
//     if (this.permits > 0) {
//       this.permits--
//       return
//     }

//     return new Promise((resolve) => {
//       this.waiting.push(resolve)
//     })
//   }

//   release(): void {
//     if (this.waiting.length > 0) {
//       const resolve = this.waiting.shift()!
//       resolve()
//     } else {
//       this.permits++
//     }
//   }
// }

// // Usage example:
// /*
// const fetcher = new LendingHistoryFetcher({
//   concurrencyLimit: 5, // Adjust based on API rate limits
// })

// const result = await fetcher.fetchAccountHistory('account_rdx16y4jfcu7ncfycf3hx2qe52g3zfguvjzm2rn5c0ntf0m7zpfaych2fr')

// console.log('History entries:', result.history.length)
// console.log('Current balances:', result.currentBalances)
// console.log('Calculated balances:', result.calculatedBalances)
// */
