import type { WeftLedgerStateClient } from './base-client'
import type { MarketOperations } from './market-operations'
import type { PoolOperations } from './pool-operations'
import { dec } from '../../../state-fetcher/src/utils'
import { defaultLendingPools, PROTOCOL_INTEREST_SHARE, STAKEHOLDER_REWARD_SHARE, WEFT_RESOURCE, WEFT_STAKING_COMPONENT, XUSDC_RESOURCE } from '../lib/const'

export class WeftStakingOperations {
  constructor(
    private client: WeftLedgerStateClient,
    private marketOps: MarketOperations,
    private poolOps: PoolOperations,
  ) {}

  async getWeftStakingApr(): Promise<{ apr: number, staked: number, tvl_xrd: number, tvl_usd: number }> {
    const emptyResult = { apr: 0, staked: 0, tvl_xrd: 0, tvl_usd: 0 }

    // Fetch prices and pool stats in parallel
    const [prices, poolStats] = await Promise.all([
      this.marketOps.getPrice([WEFT_RESOURCE, ...defaultLendingPools]),
      this.poolOps.getPoolInfos(),
    ])

    // Create price map
    const priceMap = new Map(prices.map(p => [p.resourceAddress, dec(p.price)]))

    const xusdcPrice = priceMap.get(XUSDC_RESOURCE)
    if (!xusdcPrice)
      return emptyResult

    // Calculate total lending value and weighted APR
    let totalLendingDepositsUSD = dec(0)
    let weighedApr = dec(0)

    for (const pool of poolStats.pools) {
      const price = priceMap.get(pool.resourceAddress)
      if (!price)
        continue

      const depositUSD = dec(pool.totalDeposit).mul(price)
      totalLendingDepositsUSD = totalLendingDepositsUSD.add(depositUSD)
      weighedApr = weighedApr.add(dec(pool.netLendingApr).mul(depositUSD))
    }

    if (totalLendingDepositsUSD.eq(0))
      return emptyResult

    const averageLendingApr = weighedApr.div(totalLendingDepositsUSD)

    // Get total Weft supply from component
    const { items } = await this.client.getGatewayApi().state.innerClient.entityFungiblesPage({
      stateEntityFungiblesPageRequest: { address: WEFT_STAKING_COMPONENT },
    })

    const weftData = items.find(i => i.resource_address === WEFT_RESOURCE)
    if (!weftData || weftData.aggregation_level !== 'Global')
      return emptyResult

    const stakedWeftAmount = dec(weftData.amount)
    const weftPrice = priceMap.get(WEFT_RESOURCE)
    if (!weftPrice || stakedWeftAmount.eq(0))
      return emptyResult

    const stakedWeftValueUSD = stakedWeftAmount.mul(weftPrice)

    // Final staking APR calculation
    const stakingApr = averageLendingApr.mul(totalLendingDepositsUSD).mul(PROTOCOL_INTEREST_SHARE).mul(STAKEHOLDER_REWARD_SHARE).div(stakedWeftValueUSD)

    return { apr: stakingApr.toNumber(), staked: stakedWeftAmount.toNumber(), tvl_xrd: stakedWeftValueUSD.toNumber(), tvl_usd: stakedWeftValueUSD.div(xusdcPrice).toNumber() }
  }
}
