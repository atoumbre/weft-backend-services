import type { EnvFactory, ILogger } from '@local-packages/common-utils'
import { createLogger } from '@local-packages/common-utils'

export type { EnvFactory } from '@local-packages/common-utils'

const logger = createLogger({ service: 'liquidator' })

/**
 * Configuration for the liquidator service.
 */
export interface LiquidatorConfig {
  env: EnvFactory
  logger?: ILogger
}

/**
 * Platform-agnostic liquidation message structure.
 */
export interface LiquidationMessage {
  messageId: string
  body: string
}

/**
 * Parsed liquidation message body.
 */
export interface LiquidationPayload {
  cdpId: string
  runId?: string
  reason?: string
}

/**
 * Result of processing a liquidation message.
 */
export interface ProcessResult {
  success: boolean
  messageId: string
  cdpId?: string
  error?: Error
}

/**
 * Process a single liquidation message.
 *
 * This is the core business logic for processing CDP liquidations.
 * It is platform-agnostic and can be tested locally without AWS mocks.
 *
 * @param message - The message to process
 * @param baseLogger - Logger instance
 * @returns ProcessResult indicating success/failure
 */
export async function processLiquidationMessage(
  message: LiquidationMessage,
  baseLogger: ILogger = logger,
): Promise<ProcessResult> {
  const { messageId, body } = message

  if (!body) {
    baseLogger.error({
      event: 'liquidator.message.empty_body',
      messageId,
    })
    return { success: true, messageId } // Success = don't retry empty messages
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  }
  catch (e) {
    // Invalid JSON - can't fix by retrying, so mark as success to remove from queue
    baseLogger.error({
      event: 'liquidator.message.invalid_json',
      messageId,
      bodyLength: body.length,
      err: e,
    })
    return { success: true, messageId }
  }

  const runId = typeof payload.runId === 'string' ? payload.runId : undefined
  const cdpId = typeof payload.cdpId === 'string' ? payload.cdpId : undefined

  if (!cdpId) {
    baseLogger.error({
      event: 'liquidator.message.missing_cdp_id',
      messageId,
    })
    return { success: true, messageId } // Can't process without CDP ID
  }

  // Create contextual logger for this message
  const localLogger = baseLogger.child({ runId, messageId, cdpId })

  localLogger.info({ event: 'liquidator.message.received' })

  try {
    // TODO: Implement actual liquidation logic
    // This would call the Radix blockchain to liquidate the CDP
    // await liquidateCdp(cdpId, localLogger)
    localLogger.info({ event: 'liquidator.cdp.liquidating', cdpId })

    localLogger.info({ event: 'liquidator.message.completed' })
    return { success: true, messageId, cdpId }
  }
  catch (error) {
    localLogger.error({
      event: 'liquidator.cdp.failed',
      cdpId,
      err: error,
    })
    // Return failure to indicate this message should be retried
    return {
      success: false,
      messageId,
      cdpId,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Process a batch of liquidation messages.
 *
 * @param messages - Array of messages to process
 * @param baseLogger - Logger instance
 * @returns Array of message IDs that failed processing
 */
export async function processBatch(
  messages: LiquidationMessage[],
  baseLogger: ILogger = logger,
): Promise<string[]> {
  const failedIds: string[] = []

  const results = await Promise.all(
    messages.map(message => processLiquidationMessage(message, baseLogger)),
  )

  for (const result of results) {
    if (!result.success) {
      failedIds.push(result.messageId)
    }
  }

  return failedIds
}
