import type { WeftRadixApiServiceInterface } from '../src/api'
import { beforeEach, describe, expect, it } from 'bun:test'
import { dec } from '../../state-fetcher/src/utils'
import { WeftLedgerSateFetcher } from '../src/api'
import { defaultLendingPools } from '../src/lib/const'

let api: WeftRadixApiServiceInterface

beforeEach(() => {
  api = WeftLedgerSateFetcher.setInstance()
})

describe('WeftLedgerSateFetcher', () => {
  // LIVE
  it('getPoolInfos returns expected pool data', async () => {
    const result = await (await api.getPoolInfos()).pools

    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(11)
    expect(result[0]).toHaveProperty('resourceAddress')
  })

  it('getPrice returns prices for known resources', async () => {
    const prices = await api.getPrice(defaultLendingPools)
    expect(prices[0]!.resourceAddress).toBe(defaultLendingPools[0]!)
    expect(typeof prices[0]!.price.toString()).toBe('string')

    expect(prices[0]!.price).toEqual(dec(1))
  })

  it('getMultipleCdp returns correct CDP data in batches', async () => {
    const ids = ['#1#', '#2#', '#177#']
    const result = (await api.getMultipleCdp(ids, { cdpPerBatch: 3 })).data

    expect(result.map(id => id.id)).toEqual(expect.arrayContaining(ids))
    expect(result.find(id => id.id === '#1#')).toHaveProperty('totalLoanValue')
  })

  it('getMultipleCdp reports progress updates', async () => {
    const ids = ['#1#', '#2#', '#177#']
    const updates: number[] = []

    const response = await api.getMultipleCdp(ids, { cdpPerBatch: 1, onProgress: (fetched) => {
      updates.push(fetched)
    } })

    expect(updates.length).toBeGreaterThanOrEqual(1)
    expect(updates[0]).toEqual(ids.length)

    // const lastUpdate = updates[updates.length - 1]!
    // expect(lastUpdate.total).toBe(ids.length)
    // expect(lastUpdate.fetched).toBe(response.data.length)

    if (response.data.length > 0) {
      expect(updates.some(update => update > 0)).toBe(true)
    }
  })

  it('getSingleCdp returns correct CDP data updated', async () => {
    const cdp0 = (await api.getMultipleCdp(['#1#'])).data[0]!

    const preManifest = `
      CALL_METHOD
          Address("account_rdx168r05zkmtvruvqfm4rfmgnpvhw8a47h6ln7vl3rgmyrlzmfvdlfgcg")
          "create_proof_of_non_fungibles"
          Address("resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r")
          Array<NonFungibleLocalId>(
              NonFungibleLocalId("#1#")
          )
      ;
      POP_FROM_AUTH_ZONE
          Proof("proof1")
      ;
      CALL_METHOD
          Address("component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w")
          "cdp_batch_operation"
          Proof("proof1")
          Array<Bucket>()
          Array<Bucket>()
          Map<Address, Decimal>()
          Array<Bucket>()
          Map<Address, Decimal>()
          Map<Address, Array>()
      ;
      CALL_METHOD
          Address("account_rdx168r05zkmtvruvqfm4rfmgnpvhw8a47h6ln7vl3rgmyrlzmfvdlfgcg")
          "deposit_batch"
          Expression("ENTIRE_WORKTOP")
      ;
    `

    const id = '#1#'
    const cdp1 = await api.getSingleCdp(id, preManifest)

    // expect(result.map(id => id.id)).toEqual(expect.arrayContaining(ids))
    expect(cdp1.healthLtv.toNumber()).toBeGreaterThanOrEqual(cdp0.healthLtv.toNumber())
  })

  // HISTORICAL
  it('getPoolInfosAtLedgerState returns consistent state', async () => {
    const result = (await api.getPoolInfos({ state_version: 370965851 })).pools
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBe(10)
  })

  it('getPriceAtLedgerState returns historical prices', async () => {
    const result = await api.getPrice(defaultLendingPools, { state_version: 370965851 })

    expect(result[0]).toHaveProperty('price')
    expect(result[0]?.price).toEqual(dec(1))
    expect(result[1]?.price).toEqual(dec('1.15047434827771029'))
    expect(result[2]?.price).toEqual(dec('225.570215353101481709'))
    expect(result[3]?.price).toEqual(dec('229.37458999284351145'))
    expect(result[4]?.price).toEqual(dec('25371681.638553747064004698'))
    expect(result[5]?.price).toEqual(dec('983041.381534883294186729'))
    expect(result[6]?.price).toEqual(dec('212.057781870932030311'))
    expect(result[7]?.price).toEqual(dec('212.096979124913312083'))
    expect(result[8]?.price).toEqual(dec('24026469.862403551858482542'))
    expect(result[9]?.price).toEqual(dec('937437.568386001396553862'))
  })

  it('getCdpIds returns active only by default', async () => {
    const ids = await api.getCdpIds(false)
    expect(ids.length).toBeGreaterThan(0)
    expect(ids[0]).toHaveProperty('non_fungible_id')
  })

  it('getCdpIds returns burnt when requested', async () => {
    const ids = await api.getCdpIds(true)
    expect(ids.some(id => id.is_burned === true)).toBe(true)
    expect(ids.some(id => id.is_burned !== true)).toBe(false)
  })

  it('getWeftStakingApr returns valid APR stats', async () => {
    const result = await api.getWeftStakingApr()
    expect(typeof result.apr).toBe('number')
    expect(result.apr).toBeGreaterThanOrEqual(0)
    expect(result.tvl_xrd).toBeGreaterThan(0)
  })

  it('handles empty inputs gracefully', async () => {
    // const pool = await api.getPoolInfos()
    // expect(pool.length).toBe(0)

    const price = await api.getPrice([])
    expect(price.length).toBe(0)
  })

  it('returns consistent price across getPrice and getPriceAtLedgerState (latest)', async () => {
    const live = await api.getPrice(defaultLendingPools)
    const historical = await api.getPrice(defaultLendingPools)

    expect(historical[0]!.price.toString()).toBe(live[0]!.price.toString())
  })
})
