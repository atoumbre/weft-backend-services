/// <reference types="bun-types" />

import type { LiquidationMessage } from '../src/index'
import { expect, test } from 'bun:test'
import { processBatch, processLiquidationMessage } from '../src/index'

const silentLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  child() { return this },
}

test('processLiquidationMessage handles empty body', async () => {
  const message: LiquidationMessage = { messageId: 'msg-1', body: '' }
  const result = await processLiquidationMessage(message, silentLogger)

  expect(result.success).toBe(true)
  expect(result.messageId).toBe('msg-1')
})

test('processLiquidationMessage handles invalid JSON', async () => {
  const message: LiquidationMessage = { messageId: 'msg-2', body: 'not json' }
  const result = await processLiquidationMessage(message, silentLogger)

  expect(result.success).toBe(true) // Can't fix bad JSON, so mark as success
  expect(result.messageId).toBe('msg-2')
})

test('processLiquidationMessage handles missing cdpId', async () => {
  const message: LiquidationMessage = {
    messageId: 'msg-3',
    body: JSON.stringify({ runId: 'run-1' }),
  }
  const result = await processLiquidationMessage(message, silentLogger)

  expect(result.success).toBe(true) // Can't process without cdpId
  expect(result.messageId).toBe('msg-3')
})

test('processLiquidationMessage successfully processes valid message', async () => {
  const message: LiquidationMessage = {
    messageId: 'msg-4',
    body: JSON.stringify({ cdpId: 'cdp-123', runId: 'run-1', reason: 'High LTV' }),
  }
  const result = await processLiquidationMessage(message, silentLogger)

  expect(result.success).toBe(true)
  expect(result.messageId).toBe('msg-4')
  expect(result.cdpId).toBe('cdp-123')
})

test('processBatch processes multiple messages and collects failures', async () => {
  const messages: LiquidationMessage[] = [
    { messageId: 'msg-1', body: JSON.stringify({ cdpId: 'cdp-1' }) },
    { messageId: 'msg-2', body: JSON.stringify({ cdpId: 'cdp-2' }) },
    { messageId: 'msg-3', body: 'invalid' },
  ]

  const failedIds = await processBatch(messages, silentLogger)

  // All should succeed (even invalid JSON marks as success to avoid retries)
  expect(failedIds.length).toBe(0)
})
