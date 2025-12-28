import type { SQSHandler, SQSRecord } from 'aws-lambda'
import { createLogger, getSSMParameter, requireEnv } from '@local-packages/common-utils'

//
//
// Initialize logger outside the handler to reuse it across warm invocations
const logger = createLogger({ service: 'liquidator-lambda' })

/**
 * Business logic to process ONE SQS message containing ONE CDP ID.
 * Throws an error if liquidation fails, triggering a retry for this message.
 */
async function processRecord(record: SQSRecord, baseLogger: typeof logger) {
  const messageId = record.messageId
  if (!record.body)
    return

  let body: any
  try {
    body = JSON.parse(record.body)
  }
  catch (e) {
    // If JSON is invalid, we log error but DO NOT throw.
    // We cannot "fix" bad JSON by retrying, so we let it succeed (consume the message) to remove it from the queue.
    baseLogger.error({
      event: 'liquidator.message.invalid_json',
      messageId,
      bodyLength: record.body.length,
      err: e,
    })
    return
  }

  const runId = typeof body.runId === 'string' ? body.runId : undefined
  const cdpId = typeof body.cdpId === 'string' ? body.cdpId : undefined

  if (!cdpId) {
    baseLogger.error({
      event: 'liquidator.message.missing_cdp_id',
      messageId,
    })
    return
  }

  // Contextual logger for this specific message
  const localLogger = baseLogger.child({ runId, messageId, cdpId })

  localLogger.info({ event: 'liquidator.message.received' })

  try {
    // TODO: Implement actual liquidation logic
    // await liquidateCdp(cdpId, localLogger)
    localLogger.info({ event: 'liquidator.cdp.liquidating', cdpId })

    localLogger.info({ event: 'liquidator.message.completed' })
  }
  catch (e) {
    localLogger.error({
      event: 'liquidator.cdp.failed',
      cdpId,
      err: e,
    })
    // Re-throw to mark this message as failed for partial batch failure reporting
    throw e
  }
}

export const handler: SQSHandler = async (event) => {
  const seedPhraseParamPath = requireEnv('SEED_PHRASE_PARAM')

  if (seedPhraseParamPath) {
    try {
      const seedPhrase = await getSSMParameter(seedPhraseParamPath)
      logger.info({
        event: 'liquidator.ssm.seed_phrase_retrieved',
        path: seedPhraseParamPath,
        length: seedPhrase.length,
      })
    }
    catch (error) {
      logger.error({
        event: 'liquidator.ssm.seed_phrase_failed',
        path: seedPhraseParamPath,
        err: error,
      })
      // We might want to throw here if this is critical
    }
  }

  const batchItemFailures: { itemIdentifier: string }[] = []

  // Process all records in the batch (Lambda batch size is usually 10)
  const promises = event.Records.map(async (record) => {
    try {
      await processRecord(record, logger)
    }
    catch (error) {
      // If processing failed (e.g. network error, logic error),
      // mark this SPECIFIC message ID as failed.
      logger.error({
        event: 'liquidator.handler.record_failed',
        messageId: record.messageId,
        err: error,
      })
      batchItemFailures.push({ itemIdentifier: record.messageId })
    }
  })

  // Wait for all processing to finish
  await Promise.all(promises)

  // Return list of failed messages to SQS so it only retries those
  return { batchItemFailures }
}
