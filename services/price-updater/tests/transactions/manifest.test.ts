/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'
import { buildManifest } from '../../src/transactions'

describe('buildManifest', () => {
  it('should generate valid Radix manifest', () => {
    const params = {
      accountAddress: 'account_rdx1234567890abcdef',
      badgeResourceAddress: 'resource_rdx1badge123',
      oracleComponentAddress: 'component_rdx1oracle123',
      badgeId: '#1#',
      prices: [
        { symbol: 'XRD', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', price: '1', source: 'fixed' },
        { symbol: 'xUSDT', resourceAddress: 'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', price: '2.22', source: 'pyth' },
      ],
    }

    const manifest = buildManifest(params)

    expect(manifest).toContain('CALL_METHOD')
    expect(manifest).toContain('create_proof_of_non_fungibles')
    expect(manifest).toContain('update_prices')
    expect(manifest).toContain(params.accountAddress)
    expect(manifest).toContain(params.oracleComponentAddress)
    expect(manifest).toContain(params.badgeResourceAddress)

    params.prices.forEach((price) => {
      expect(manifest).toContain(price.resourceAddress)
      expect(manifest).toContain(`Decimal("${price.price}")`)
    })
  })
})
