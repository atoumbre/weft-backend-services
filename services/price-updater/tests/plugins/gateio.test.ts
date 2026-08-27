/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { GateioPlugin } from '../../src/plugins/gateio'

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child: () => silentLogger,
}

const options = { timeoutMs: 5000 }

let originalFetch: typeof globalThis.fetch

describe('GateioPlugin', () => {
  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses last from a ticker array', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(JSON.stringify([
      { currency_pair: 'XRD_USDT', last: '0.00092' },
    ]))))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['XRD_USDT'], options, silentLogger)
    const result = results.get('XRD_USDT')

    expect(result).toEqual({
      price: '0.00092',
      currency: 'USD',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRD_USDT',
    )
  })

  it('stringifies a numeric last', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify([
      { currency_pair: 'ETH_USDT', last: 3500 },
    ])))) as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['ETH_USDT'], options, silentLogger)

    expect(results.get('ETH_USDT')?.price).toBe('3500')
  })

  it('does not fetch when the identifier list is empty', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response('[]')))
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch([], options, silentLogger)

    expect(results.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns an empty map when last is missing', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify([
      { currency_pair: 'XRD_USDT' },
    ])))) as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['XRD_USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map when last is empty', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response(JSON.stringify([
      { currency_pair: 'XRD_USDT', last: '' },
    ])))) as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['XRD_USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map on HTTP error without throwing', async () => {
    globalThis.fetch = mock(() => Promise.resolve(new Response('rate limited', { status: 429 }))) as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['XRD_USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })

  it('returns an empty map when fetch throws', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('network down'))) as typeof globalThis.fetch

    const plugin = new GateioPlugin('https://api.gateio.ws')
    const results = await plugin.fetchBatch(['XRD_USDT'], options, silentLogger)

    expect(results.size).toBe(0)
  })
})
