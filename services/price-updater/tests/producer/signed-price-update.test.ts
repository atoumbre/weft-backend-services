/// <reference types="bun-types" />

import type { PriceUpdateRunnerConfig } from '../../src/execution/run-price-update'
import { verify } from '@noble/ed25519'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { canonicalJson, createSignedPriceUpdate, hexToBytes } from '../../src/producer'

const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const mockCoinGeckoResponse = {
  radix: { usd: 0.45 },
  tether: { usd: 1.0 },
}

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const config: PriceUpdateRunnerConfig = {
  badgeResourceAddress: 'resource_rdx1testbadge',
  oracleComponentAddress: 'component_rdx1czdvvanvdy6495phfgz8uv6n2semp2cpexcg6vvty6uaycc82adgyv',
  badgeId: '#1#',
  networkName: 'Mainnet' as const,
  mnemonic: testMnemonic,
  derivationIndex: 0,
  dryRun: true,
  coingeckoBaseUrl: 'https://api.coingecko.com',
  kucoinBaseUrl: 'https://api.kucoin.com',
  gateioBaseUrl: 'https://api.gateio.ws',
  caviarnineBaseUrl: 'https://api.caviarnine.com',
  astrolescentBaseUrl: 'https://api.astrolescent.com/partner/test/prices',
  timeoutMs: 5000,
  transactionFeeXrd: 1,
  signedPayloadTtlSec: 60,
  disableKucoin: true,
  disableGateio: true,
  disableCaviarNine: true,
  disableCoinGecko: false,
  disableAstrolescent: true,
  logLevel: 'info',
}

let originalFetch: typeof globalThis.fetch

describe('signed price update producer', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('canonicalizes objects recursively with stable key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 }, list: [{ z: true, y: false }] }))
      .toBe('{"a":{"c":3,"d":4},"b":1,"list":[{"y":false,"z":true}]}')
  })

  it('returns a signed payload for the current prices', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('coingecko.com')) {
        return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    const result = await createSignedPriceUpdate(config, silentLogger)

    expect(result.isOk()).toBe(true)
    if (result.isErr())
      throw result.error

    expect(result.value.payload.schemaVersion).toBe(1)
    expect(result.value.payload.type).toBe('weft.price_update')
    expect(result.value.payload.networkId).toBe(1)
    expect(result.value.payload.oracleComponentAddress).toBe(config.oracleComponentAddress)
    expect(result.value.payload.prices.length).toBeGreaterThan(0)
    expect(result.value.payloadSborProgrammaticJson).toBeDefined()
    expect(result.value.payloadSborHex.length).toBeGreaterThan(0)
    expect(result.value.publicKey).toHaveLength(64)
    expect(result.value.signature).toHaveLength(128)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('verifies valid signatures and rejects tampered payloads', async () => {
    const fetchMock = mock((url: string) => {
      if (url.includes('coingecko.com')) {
        return Promise.resolve(new Response(JSON.stringify(mockCoinGeckoResponse)))
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })

    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

    const result = await createSignedPriceUpdate(config, silentLogger)

    expect(result.isOk()).toBe(true)
    if (result.isErr())
      throw result.error

    const payloadBytes = hexToBytes(result.value.payloadSborHex)
    const tamperedPayloadBytes = Uint8Array.from(payloadBytes)
    tamperedPayloadBytes[tamperedPayloadBytes.length - 1] ^= 1

    expect(verify(result.value.signature, payloadBytes, result.value.publicKey)).toBe(true)
    expect(verify(result.value.signature, tamperedPayloadBytes, result.value.publicKey)).toBe(false)
  })
})
