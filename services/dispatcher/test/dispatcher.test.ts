/// <reference types="bun-types" />

import type { CdpIdFetcher, QueueBatchSender } from '../src/index'
import { expect, test } from 'bun:test'
import { createDispatcherHandler } from '../src/index'

function makeIds(count: number) {
  return Array.from({ length: count }, (_, i) => `cdp-${i}`)
}

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child() { return this },
}

test('dispatches IDs in chunk-sized messages', async () => {
  const sent: { Id: string, MessageBody: string }[][] = []
  const queueSender: QueueBatchSender = {
    async sendBatch(entries) {
      sent.push(entries)
      return { failed: [] }
    },
  }

  const ids = makeIds(25)
  const fetcher: CdpIdFetcher = {
    getCdpIds: async () =>
      ids.map(non_fungible_id => ({
        non_fungible_id,
        is_burned: false,
        last_updated_at_state_version: 0,
      })),
  }

  const handler = createDispatcherHandler({
    queueSender,
    fetcher,
    indexerBatchSize: 10,
    logger: silentLogger,
    runIdFactory: () => 'run-123',
  })

  const result = await handler()
  expect(result.statusCode).toBe(200)
  expect(result.body).toBe('Dispatched 25 CDPs')

  expect(sent.length).toBe(1)
  expect(sent[0]!.length).toBe(3)

  const bodies = sent[0]!.map(e => JSON.parse(e.MessageBody))
  expect(bodies[0].cdpIds).toEqual(ids.slice(0, 10))
  expect(bodies[1].cdpIds).toEqual(ids.slice(10, 20))
  expect(bodies[2].cdpIds).toEqual(ids.slice(20, 25))
  expect(bodies.every((body: any) => body.runId === 'run-123')).toBe(true)
})

test('sends multiple batches when there are >10 chunks', async () => {
  const sent: { Id: string, MessageBody: string }[][] = []
  const queueSender: QueueBatchSender = {
    async sendBatch(entries) {
      sent.push(entries)
      return { failed: [] }
    },
  }

  const ids = makeIds(105) // 21 chunks of 5
  const fetcher: CdpIdFetcher = {
    getCdpIds: async () =>
      ids.map(non_fungible_id => ({
        non_fungible_id,
        is_burned: false,
        last_updated_at_state_version: 0,
      })),
  }

  const handler = createDispatcherHandler({
    queueSender,
    fetcher,
    indexerBatchSize: 5,
    logger: silentLogger,
  })

  await handler()

  expect(sent.length).toBe(3)
  expect(sent[0]!.length).toBe(10)
  expect(sent[1]!.length).toBe(10)
  expect(sent[2]!.length).toBe(1)
})

test('rejects invalid batch sizes', () => {
  const queueSender: QueueBatchSender = {
    async sendBatch() { return { failed: [] } },
  }

  expect(() =>
    createDispatcherHandler({
      queueSender,
      fetcher: { getCdpIds: async () => [] },
      indexerBatchSize: 0,
    }),
  ).toThrow(/Invalid indexerBatchSize/)
})

test('propagates fetcher failures', async () => {
  const queueSender: QueueBatchSender = {
    async sendBatch() { return { failed: [] } },
  }
  const fetcher: CdpIdFetcher = {
    getCdpIds: async () => {
      throw new Error('boom')
    },
  }

  const handler = createDispatcherHandler({
    queueSender,
    fetcher,
    indexerBatchSize: 10,
    logger: silentLogger,
  })

  await expect(handler()).rejects.toThrow('boom')
})

test('retries failed messages', async () => {
  let callCount = 0
  const queueSender: QueueBatchSender = {
    async sendBatch(entries) {
      callCount++
      if (callCount === 1) {
        // First call fails one message
        return { failed: [entries[0]!.Id] }
      }
      // Retry succeeds
      return { failed: [] }
    },
  }

  const ids = makeIds(5)
  const fetcher: CdpIdFetcher = {
    getCdpIds: async () =>
      ids.map(non_fungible_id => ({
        non_fungible_id,
        is_burned: false,
        last_updated_at_state_version: 0,
      })),
  }

  const handler = createDispatcherHandler({
    queueSender,
    fetcher,
    indexerBatchSize: 5,
    logger: silentLogger,
  })

  const result = await handler()
  expect(result.statusCode).toBe(200)
  expect(callCount).toBe(2) // Original + retry
})
