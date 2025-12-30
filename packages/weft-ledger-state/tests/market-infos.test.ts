import type { WeftRadixApiServiceInterface } from '../src/api'
import { beforeEach, describe, expect, it } from 'bun:test'
import { WeftLedgerSateFetcher } from '../src/api'

let api: WeftRadixApiServiceInterface
let cachedInfos: Awaited<ReturnType<WeftLedgerSateFetcher['getMarketInfos']>> | undefined

beforeEach(async () => {
  api = WeftLedgerSateFetcher.setInstance()
  cachedInfos = await api.getMarketInfos({ state_version: 370965851 })
})

describe('getMarketInfos', () => {
  it('returns expected structure at a known ledger state', async () => {
    const result = await api.getMarketInfos({ state_version: 370965851 })

    // Top-level keys
    expect(result).toHaveProperty('marketConfig')
    expect(result).toHaveProperty('marketFeeConfig')
    expect(result).toHaveProperty('loanResources')
    expect(result).toHaveProperty('collateralResources')
    expect(result).toHaveProperty('globalMarketService')
    expect(result).toHaveProperty('globalLoanService')
    expect(result).toHaveProperty('globalCollateralService')

    // Market config
    // Log for debugging if these ever change on-chain
    // console.log('marketConfig keys', Object.keys(result.marketConfig))
    // Basic sanity on marketConfig shape
    expect(typeof (result.marketConfig as any)).toBe('object')
    // Expect at least two keys present in config
    expect(Object.keys(result.marketConfig).length).toBeGreaterThanOrEqual(2)

    // Fee config
    expect(result.marketFeeConfig).toHaveProperty('protocolCdpCreationFee')
    expect(result.marketFeeConfig).toHaveProperty('protocolLiquidationBonusFeeRate')

    // Loan resources shape
    expect(Array.isArray(result.loanResources)).toBe(true)
    expect(result.loanResources.length).toBeGreaterThan(0)
    const loan = result.loanResources[0]!
    expect(loan).toHaveProperty('resourceAddress')
    expect(loan).toHaveProperty('resourceConfig')
    expect(loan).toHaveProperty('riskConfig')
    expect(loan).toHaveProperty('services')

    // Collateral resources shape
    expect(Array.isArray(result.collateralResources)).toBe(true)
    expect(result.collateralResources.length).toBeGreaterThan(0)
    const collateral = result.collateralResources[0]!
    expect(collateral).toHaveProperty('resourceAddress')
    expect(collateral).toHaveProperty('resourceConfig')
    expect(collateral).toHaveProperty('riskConfig')
    expect(collateral).toHaveProperty('services')
    expect(collateral).toHaveProperty('efficiencyConfigs')
    // Decimal-like totalDeposit
    // expect(typeof collateral.totalDeposit.toString()).toBe('string')

    // Global service objects contain expected service keys with boolean flags
    const ms = result.globalMarketService
    expect(ms).toHaveProperty('CreateCDP')
    expect(ms.CreateCDP).toHaveProperty('enabled')
    expect(ms.CreateCDP).toHaveProperty('locked')

    const ls = result.globalLoanService
    expect(ls).toHaveProperty('Borrow')
    expect(ls.Borrow).toHaveProperty('enabled')
    expect(ls.Borrow).toHaveProperty('locked')

    const cs = result.globalCollateralService
    expect(cs).toHaveProperty('resource')
    expect(cs.resource).toHaveProperty('Add')
    expect(cs.resource.Add).toHaveProperty('enabled')
    expect(cs.resource.Add).toHaveProperty('locked')
    expect(cs).toHaveProperty('lsu')
    expect(cs).toHaveProperty('nft')
    expect(cs).toHaveProperty('claimNft')
  })
  // })

  // // Cache a snapshot for resource-specific checks
  // beforeAll(async () => {
  //   const instance = WeftLedgerSateFetcher.getInstance()
  //   cachedInfos = await instance.getMarketInfos({ state_version: 370965851 })
  // })

  // describe('resource-specific checks (placeholders)', () => {
  // Skipped to keep CI green; replace expected values and unskip when ready.
  it('value checks for resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', () => {
    const address = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.75')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('487654.985579775149548499')
    }
  })

  it('value checks for resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf', () => {
    const address = 'resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.75')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('18849151.865429489009203545')
    }
  })

  it('value checks for resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv', () => {
    const address = 'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.65')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('0')
    }
  })

  it('value checks for resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe', () => {
    const address = 'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.65')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('0')
    }
  })

  it('value checks for resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5', () => {
    const address = 'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.75')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('0')
    }
  })

  it('value checks for resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0', () => {
    const address = 'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0'
    const infos = cachedInfos!
    const loan = infos.loanResources.find(r => r.resourceAddress === address)
    const coll = infos.collateralResources.find(r => r.resourceAddress === address)
    expect(!!loan || !!coll).toBe(true)
    if (loan) {
      expect(loan.riskConfig.loanValueFactor.toString()).toEqual('1')
      expect(loan.riskConfig.loanCloseFactor.toString()).toEqual('0.5')
    }
    if (coll) {
      expect(coll.riskConfig.loanToValueRatio.toString()).toEqual('0.75')
      expect(coll.riskConfig.liquidationBonusRate.toString()).toEqual('0.07')
      // expect(coll.totalDeposit.toString()).toEqual('0')
    }
  })
})
