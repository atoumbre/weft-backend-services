import type { EnvFactory, ILogger } from '@local-packages/common-utils'
import type { CdpIdFetcher } from './fetcher'
import { randomUUID } from 'node:crypto'
import { createLogger } from '@local-packages/common-utils'
import { fetchAndBatchCdpIds } from './fetcher'

export type { CdpIdFetcher, DispatchData } from './fetcher'
export { fetchAndBatchCdpIds } from './fetcher'
export type { EnvFactory } from '@local-packages/common-utils'

const logger = createLogger({ service: 'dispatcher' })

/**
 * Interface for queue batch sending operations.
 * Platform adapters (e.g., AWS SQS) must implement this interface.
 */
export interface QueueBatchSender {
  /**
   * Send a batch of messages to the queue.
   * @param entries - Array of message entries with Id and MessageBody
   * @returns Object containing array of failed message IDs
   */
  sendBatch: (entries: { Id: string, MessageBody: string }[]) => Promise<{ failed: string[] }>
}

export interface DispatcherConfig {
  queueSender: QueueBatchSender
  fetcher: CdpIdFetcher
  indexerBatchSize: number
  env?: EnvFactory
  logger?: ILogger
  runIdFactory?: () => string
}

export interface DispatchResult {
  statusCode: number
  body: string
}

/**
 * Creates a platform-agnostic dispatcher handler.
 *
 * This function fetches CDP IDs, batches them, and sends them to a queue
 * for processing by the indexer. The queue implementation is injected
 * via the queueSender interface.
 */
export function createDispatcherHandler(params: DispatcherConfig) {
  const baseLogger = params.logger ?? logger
  const indexerBatchSize = params.indexerBatchSize
  const runIdFactory = params.runIdFactory ?? (() => randomUUID())

  if (!Number.isInteger(indexerBatchSize) || indexerBatchSize <= 0) {
    throw new Error(`Invalid indexerBatchSize: ${indexerBatchSize}`)
  }

  async function sendBatch(
    entries: { Id: string, MessageBody: string }[],
    localLogger: ILogger,
    context: { batchIndex: number, batchCount: number },
  ) {
    localLogger.info({
      event: 'dispatcher.sqs.batch.send',
      batchIndex: context.batchIndex,
      batchCount: context.batchCount,
      messageCount: entries.length,
    })

    const result = await params.queueSender.sendBatch(entries)

    if (result.failed.length === 0) {
      localLogger.info({
        event: 'dispatcher.sqs.batch.sent',
        batchIndex: context.batchIndex,
        batchCount: context.batchCount,
        messageCount: entries.length,
      })
      return
    }

    // Retry failed messages (non-sender faults)
    const entryById = new Map(entries.map(entry => [entry.Id, entry]))
    const retryEntries = result.failed
      .map(id => entryById.get(id))
      .filter((entry): entry is { Id: string, MessageBody: string } => Boolean(entry))

    if (retryEntries.length === 0) {
      return
    }

    localLogger.info({
      event: 'dispatcher.sqs.batch.retry',
      batchIndex: context.batchIndex,
      batchCount: context.batchCount,
      messageCount: retryEntries.length,
    })

    const retryResult = await params.queueSender.sendBatch(retryEntries)

    if (retryResult.failed.length > 0) {
      localLogger.error({
        event: 'dispatcher.sqs.batch.retry_failed',
        batchIndex: context.batchIndex,
        batchCount: context.batchCount,
        failedCount: retryResult.failed.length,
        failedIds: retryResult.failed,
      })
      throw new Error(`Failed to send ${retryResult.failed.length} messages after retry`)
    }

    localLogger.info({
      event: 'dispatcher.sqs.batch.retry_sent',
      batchIndex: context.batchIndex,
      batchCount: context.batchCount,
      messageCount: retryEntries.length,
    })
  }

  return async (): Promise<DispatchResult> => {
    const runId = runIdFactory()
    const localLogger = baseLogger.child({ runId })

    localLogger.info({ event: 'dispatcher.start', indexerBatchSize })

    try {
      const dispatchData = await fetchAndBatchCdpIds({
        fetcher: params.fetcher,
        indexerBatchSize,
        runId,
        logger: localLogger,
      })

      if (dispatchData.length === 0) {
        localLogger.info({ event: 'dispatcher.complete', cdpCount: 0, totalChunks: 0 })
        return { statusCode: 200, body: 'No CDPs to dispatch' }
      }

      const BATCH_LIMIT = 10
      for (let i = 0; i < dispatchData.length; i += BATCH_LIMIT) {
        const batchOfChunks = dispatchData.slice(i, i + BATCH_LIMIT)

        const entries = batchOfChunks.map((chunk, index) => ({
          Id: `${i + index}`,
          MessageBody: JSON.stringify(chunk),
        }))

        const batchIndex = Math.floor(i / BATCH_LIMIT) + 1
        const batchCount = Math.ceil(dispatchData.length / BATCH_LIMIT)
        await sendBatch(entries, localLogger, { batchIndex, batchCount })
      }

      const totalCdps = dispatchData.reduce((acc, curr) => acc + curr.cdpIds.length, 0)
      localLogger.info({ event: 'dispatcher.complete', cdpCount: totalCdps, totalChunks: dispatchData.length })
      return { statusCode: 200, body: `Dispatched ${totalCdps} CDPs` }
    }
    catch (error) {
      localLogger.error({ event: 'dispatcher.error', err: error })
      throw error
    }
  }
}
