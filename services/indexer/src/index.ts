import type { EnvFactory, ILogger } from '@local-packages/common-utils'
import process from 'node:process'
import { createLogger } from '@local-packages/common-utils'
import { checkRisk, fetchCdpDetails } from './indexer'

export type { CdpDetailFetcher, CdpFetchResult } from './indexer'
export { checkRisk, fetchCdpDetails } from './indexer'
export type { EnvFactory } from '@local-packages/common-utils'

const logger = createLogger({ service: 'indexer' })

/**
 * Interface for receiving messages from a queue.
 * Platform adapters (e.g., AWS SQS) must implement this interface.
 */
export interface QueueReceiver {
  /**
   * Receive messages from the queue.
   * @param maxMessages - Maximum number of messages to receive
   * @param waitTimeSeconds - Long polling wait time
   * @returns Array of messages with MessageId, Body, and ReceiptHandle
   */
  receive: (maxMessages: number, waitTimeSeconds: number) => Promise<QueueMessage[]>

  /**
   * Delete a message from the queue after successful processing.
   * @param receiptHandle - Receipt handle of the message to delete
   */
  delete: (receiptHandle: string) => Promise<void>
}

export interface QueueMessage {
  MessageId?: string
  Body?: string
  ReceiptHandle?: string
}

/**
 * Interface for sending messages to a queue.
 * Platform adapters must implement this interface.
 */
export interface QueueSender {
  /**
   * Send a batch of messages to a queue.
   * @param entries - Array of message entries with Id and MessageBody
   */
  sendBatch: (entries: { Id: string, MessageBody: string }[]) => Promise<void>
}

/**
 * Interface for storing data.
 * Platform adapters (e.g., AWS S3) must implement this interface.
 */
export interface StorageWriter {
  /**
   * Store data at the given key.
   * @param key - Storage key/path
   * @param body - Content to store
   * @param contentType - MIME type of the content
   */
  put: (key: string, body: string, contentType: string) => Promise<void>
}

export interface MessageProcessorConfig {
  queueSender: QueueSender
  storage: StorageWriter
  fetcher: any // Type from package
  bucketName: string
  env?: EnvFactory
  logger?: ILogger
  now?: () => Date
}

/**
 * Creates a platform-agnostic message processor.
 *
 * This function processes CDP batch messages, fetches details,
 * stores to storage, and enqueues at-risk CDPs for liquidation.
 */
export function createMessageProcessor(params: MessageProcessorConfig) {
  const baseLogger = params.logger ?? logger
  const now = params.now ?? (() => new Date())

  if (!params.bucketName) {
    throw new Error('Missing bucketName')
  }

  return async function processMessage(message: QueueMessage) {
    const messageId = message.MessageId

    if (!message.Body) {
      baseLogger.error({ event: 'indexer.message.missing_body', messageId })
      return
    }

    let body: any
    try {
      body = JSON.parse(message.Body)
    }
    catch (error) {
      baseLogger.error({
        event: 'indexer.message.invalid_json',
        messageId,
        bodyLength: message.Body.length,
        err: error,
      })
      return
    }

    const runId = typeof body.runId === 'string' ? body.runId : undefined
    const chunkIndex = typeof body.chunkIndex === 'number' ? body.chunkIndex : undefined
    const chunkCount = typeof body.chunkCount === 'number' ? body.chunkCount : undefined
    const cdpIds = Array.isArray(body.cdpIds) ? body.cdpIds : []

    const localLogger = baseLogger.child({ runId, messageId, chunkIndex, chunkCount })

    if (cdpIds.length === 0) {
      localLogger.error({ event: 'indexer.message.missing_cdp_ids' })
      return
    }

    const ids = cdpIds.filter((id: any): id is string => typeof id === 'string' && id.length > 0)

    try {
      const result = await fetchCdpDetails({
        fetcher: params.fetcher,
        cdpIds: ids,
        logger: localLogger,
      })

      if (result.failedIds?.length) {
        localLogger.error({
          event: 'indexer.fetch.failed',
          failedCount: result.failedIds.length,
          failedIds: result.failedIds,
        })
        throw new Error('Failed to fetch some CDPs')
      }

      const cdps = result.data
      const timestamp = now().getTime()
      const date = new Date(timestamp)
      const key = `cdp-data/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/cdp-batch-${timestamp}.json`
      const bodyString = JSON.stringify(cdps)

      await params.storage.put(key, bodyString, 'application/json')
      localLogger.info({
        event: 'indexer.s3.write',
        key,
        bytes: Buffer.byteLength(bodyString),
      })

      const atRiskCdps = (cdps as any[]).filter(checkRisk)

      if (atRiskCdps.length > 0) {
        localLogger.info({
          event: 'indexer.at_risk.detected',
          atRiskCount: atRiskCdps.length,
        })

        // Send one CDP per message in batches of 10
        const BATCH_LIMIT = 10
        const atRiskIds = atRiskCdps.map((c: any) => c.id)

        for (let i = 0; i < atRiskIds.length; i += BATCH_LIMIT) {
          const batch = atRiskIds.slice(i, i + BATCH_LIMIT)
          const entries = batch.map((cdpId: string, index: number) => ({
            Id: `${i + index}`,
            MessageBody: JSON.stringify({
              cdpId,
              reason: 'High LTV',
              runId,
            }),
          }))

          await params.queueSender.sendBatch(entries)

          localLogger.info({
            event: 'indexer.liquidation.batch_enqueued',
            batchIndex: Math.floor(i / BATCH_LIMIT) + 1,
            batchCount: Math.ceil(atRiskIds.length / BATCH_LIMIT),
            messageCount: entries.length,
          })
        }

        localLogger.info({
          event: 'indexer.liquidation.enqueued',
          atRiskCount: atRiskCdps.length,
        })
      }
    }
    catch (error) {
      localLogger.error({
        event: 'indexer.message.error',
        err: error,
      })
      throw error
    }
  }
}

export interface IndexerWorkerConfig {
  queueReceiver: QueueReceiver
  queueSender: QueueSender
  storage: StorageWriter
  fetcher: any
  bucketName: string
  env?: EnvFactory
  logger?: ILogger
  now?: () => Date
}

/**
 * Creates a platform-agnostic indexer worker.
 *
 * This handles the polling loop for receiving messages,
 * processing them, and deleting on success.
 */
export function createIndexerWorker(params: IndexerWorkerConfig) {
  const baseLogger = params.logger ?? logger

  let shouldRun = true

  const processMessage = createMessageProcessor({
    queueSender: params.queueSender,
    storage: params.storage,
    fetcher: params.fetcher,
    bucketName: params.bucketName,
    logger: baseLogger,
    now: params.now,
  })

  async function runOnce() {
    const maxMessages = Number.parseInt(process.env.MAX_MESSAGES ?? '10', 10)
    const waitTimeSeconds = Number.parseInt(process.env.WAIT_TIME_SECONDS ?? '20', 10)

    const messages = await params.queueReceiver.receive(maxMessages, waitTimeSeconds)

    if (messages && messages.length > 0) {
      baseLogger.debug({ event: 'indexer.receive_messages', count: messages.length })
      await Promise.all(messages.map(async (msg) => {
        try {
          await processMessage(msg)
          if (msg.ReceiptHandle) {
            await params.queueReceiver.delete(msg.ReceiptHandle)
            baseLogger.info({
              event: 'indexer.message.deleted',
              messageId: msg.MessageId,
            })
          }
        }
        catch (error) {
          baseLogger.error({
            event: 'indexer.message.processing_failed',
            messageId: msg.MessageId,
            err: error,
          })
          // On error, we don't delete the message, so the queue will retry it
        }
      }))
    }
  }

  async function runForever() {
    baseLogger.info({ event: 'indexer.start' })
    const errorDelay = Number.parseInt(process.env.LOOP_ERROR_DELAY_MS ?? '5000', 10)

    // eslint-disable-next-line no-unmodified-loop-condition
    while (shouldRun) {
      try {
        await runOnce()
      }
      catch (error) {
        baseLogger.error({ event: 'indexer.loop.error', err: error })
        await new Promise(resolve => setTimeout(resolve, errorDelay))
      }
    }

    baseLogger.info({ event: 'indexer.stop' })
  }

  function stop() {
    shouldRun = false
  }

  return { processMessage, runOnce, runForever, stop, getStatus: () => ({ shouldRun }) }
}
