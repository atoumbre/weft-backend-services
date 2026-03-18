/// <reference types="bun-types" />

import type { CollateralizeDebtPositionData } from '@weft-finance/ledger-state'
import type { QueueReceiver, QueueSender, StorageWriter } from '../src/index'
import type { CdpDetailFetcher } from '../src/indexer'
import { expect, test } from 'bun:test'
import Decimal from 'decimal.js'
import { checkRisk, createIndexerWorker, createMessageProcessor } from '../src/index'

const silentLogger = {
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  child: () => silentLogger,
}

test('checkRisk returns true when liquidationLtv >= 1', () => {
  expect(checkRisk({ liquidationLtv: new Decimal(1) })).toBe(true)
  expect(checkRisk({ liquidationLtv: new Decimal('1.0001') })).toBe(true)
  expect(checkRisk({ liquidationLtv: new Decimal('0.9999') })).toBe(false)
})

test('message processor ignores messages with missing Body', async () => {
  const queueSenderCalls: unknown[] = []
  const storageCalls: unknown[] = []
  const fetcherCalls: unknown[] = []

  const fetcher: CdpDetailFetcher = {
    getMultipleCdp: async (ids: string[], options?: unknown) => {
      fetcherCalls.push([ids, options])
      return { data: [], failedIds: [] }
    },
  }

  const queueSender: QueueSender = {
    sendBatch: async (entries) => { queueSenderCalls.push(entries) },
  }

  const storage: StorageWriter = {
    put: async (key, body, contentType) => { storageCalls.push({ key, body, contentType }) },
  }

  const processMessage = createMessageProcessor({
    queueSender,
    storage,
    fetcher,
    bucketName: 'bucket',
    logger: silentLogger,
  })

  await processMessage({})

  expect(fetcherCalls.length).toBe(0)
  expect(storageCalls.length).toBe(0)
  expect(queueSenderCalls.length).toBe(0)
})

test('message processor ignores messages with empty cdpIds', async () => {
  const fetcherCalls: unknown[] = []

  const fetcher: CdpDetailFetcher = {
    getMultipleCdp: async (ids: string[], options?: unknown) => {
      fetcherCalls.push([ids, options])
      return { data: [], failedIds: [] }
    },
  }

  const queueSender: QueueSender = {
    sendBatch: async () => {},
  }

  const storage: StorageWriter = {
    put: async () => {},
  }

  const processMessage = createMessageProcessor({
    queueSender,
    storage,
    fetcher,
    bucketName: 'bucket',
    logger: silentLogger,
  })

  await processMessage({ Body: JSON.stringify({ cdpIds: [] }) })
  expect(fetcherCalls.length).toBe(0)
})

test('message processor saves CDPs to storage and does not enqueue liquidation when none are at-risk', async () => {
  const queueSenderCalls: unknown[] = []
  const storageCalls: { key: string, body: string, contentType: string }[] = []

  const cdps = [
    { id: 'a', liquidationLtv: new Decimal('0.5') },
    { id: 'b', liquidationLtv: new Decimal('0.99') },
  ] as CollateralizeDebtPositionData[]

  const queueSender: QueueSender = {
    sendBatch: async (entries) => { queueSenderCalls.push(entries) },
  }

  const storage: StorageWriter = {
    put: async (key, body, contentType) => { storageCalls.push({ key, body, contentType }) },
  }

  const processMessage = createMessageProcessor({
    queueSender,
    storage,
    fetcher: { getMultipleCdp: async () => ({ data: cdps, failedIds: [] }) },
    bucketName: 'bucket',
    logger: silentLogger,
    now: () => new Date(Date.UTC(2025, 0, 2, 3, 4, 5)),
  })

  await processMessage({ Body: JSON.stringify({ cdpIds: ['x', 'y'] }) })

  expect(storageCalls.length).toBe(1)
  expect(storageCalls[0]!.key).toBe(`cdp-data/2025/01/02/cdp-batch-${Date.UTC(2025, 0, 2, 3, 4, 5)}.json`)
  expect(storageCalls[0]!.contentType).toBe('application/json')
  expect(storageCalls[0]!.body).toBe(JSON.stringify(cdps))

  expect(queueSenderCalls.length).toBe(0)
})

test('message processor enqueues liquidation when there are at-risk CDPs', async () => {
  const queueSenderCalls: { Id: string, MessageBody: string }[][] = []
  const storageCalls: unknown[] = []

  const cdps = [
    { id: 'safe', liquidationLtv: new Decimal('0.75') },
    { id: 'risk', liquidationLtv: new Decimal('1.0') },
    { id: 'risk2', liquidationLtv: new Decimal('1.5') },
  ] as CollateralizeDebtPositionData[]

  const queueSender: QueueSender = {
    sendBatch: async (entries) => { queueSenderCalls.push(entries) },
  }

  const storage: StorageWriter = {
    put: async (key, body, contentType) => { storageCalls.push({ key, body, contentType }) },
  }

  const processMessage = createMessageProcessor({
    queueSender,
    storage,
    fetcher: { getMultipleCdp: async () => ({ data: cdps, failedIds: [] }) },
    bucketName: 'bucket',
    logger: silentLogger,
    now: () => new Date(Date.UTC(2025, 5, 1, 0, 0, 0)),
  })

  await processMessage({ Body: JSON.stringify({ cdpIds: ['id1'] }) })

  expect(storageCalls.length).toBe(1)
  expect(queueSenderCalls.length).toBe(1)

  // Verify individual messages - one CDP per message
  const entries = queueSenderCalls[0]
  expect(entries!.length).toBe(2) // 'risk' and 'risk2'

  const payloads = entries!.map(e => JSON.parse(e.MessageBody))
  expect(payloads[0].cdpId).toBe('risk')
  expect(payloads[0].reason).toBe('High LTV')
  expect(payloads[1].cdpId).toBe('risk2')
  expect(payloads[1].reason).toBe('High LTV')
})

test('indexer worker runOnce deletes messages after processing', async () => {
  const receiveCalls: unknown[] = []
  const deleteCalls: string[] = []
  const storageCalls: unknown[] = []
  const fetcherCalls: unknown[] = []

  const fetcher: CdpDetailFetcher = {
    getMultipleCdp: async (ids: string[], options?: unknown) => {
      fetcherCalls.push([ids, options])
      return { data: [], failedIds: [] }
    },
  }

  const queueReceiver: QueueReceiver = {
    receive: async (maxMessages, waitTimeSeconds) => {
      receiveCalls.push({ maxMessages, waitTimeSeconds })
      return [{ Body: JSON.stringify({ cdpIds: ['a'] }), ReceiptHandle: 'rh-1', MessageId: 'msg-1' }]
    },
    delete: async (receiptHandle) => {
      deleteCalls.push(receiptHandle)
    },
  }

  const queueSender: QueueSender = {
    sendBatch: async () => {},
  }

  const storage: StorageWriter = {
    put: async (key, body, contentType) => { storageCalls.push({ key, body, contentType }) },
  }

  const worker = createIndexerWorker({
    queueReceiver,
    queueSender,
    storage,
    fetcher,
    bucketName: 'bucket',
    logger: silentLogger,
    now: () => new Date(Date.UTC(2025, 0, 1, 0, 0, 0)),
  })

  await worker.runOnce()

  expect(receiveCalls.length).toBe(1)
  expect(deleteCalls.length).toBe(1)
  expect(deleteCalls[0]).toBe('rh-1')

  expect(fetcherCalls.length).toBe(1)
  expect(storageCalls.length).toBe(1)
})
