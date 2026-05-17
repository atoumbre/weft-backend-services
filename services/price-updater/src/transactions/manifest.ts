import type { PriceResult } from '../pricing/resolve-prices'

export function buildManifest(params: {
  accountAddress: string
  badgeResourceAddress: string
  badgeId: string
  oracleComponentAddress: string
  prices: PriceResult[]
  transactionFee?: number
}) {
  const entries = params.prices.map(price => (
    `    Address("${price.resourceAddress}") => Decimal("${price.price}")`
  ))

  return [
    ...(params.transactionFee !== undefined && params.transactionFee > 0
      ? [
          'CALL_METHOD',
          `    Address("${params.accountAddress}")`,
          '    "lock_fee"',
          `    Decimal("${params.transactionFee}")`,
          ';',
        ]
      : []),
    '',
    'CALL_METHOD',
    `    Address("${params.accountAddress}")`,
    '    "create_proof_of_non_fungibles"',
    `    Address("${params.badgeResourceAddress}")`,
    '    Array<NonFungibleLocalId>(',
    `        NonFungibleLocalId("${params.badgeId}")`,
    '    )',
    ';',
    '',
    'CALL_METHOD',
    `  Address("${params.oracleComponentAddress}")`,
    '  "update_prices"',
    '  Map<Address, Decimal>(',
    entries.join(',\n'),
    '  )',
    ';',
  ].join('\n')
}
