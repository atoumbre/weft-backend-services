/**
 * AWS Lambda Wrapper for Liquidator Service
 *
 * This is the platform-specific entry point that:
 * 1. Creates an EnvFactory with cached SSM parameters using common-utils
 * 2. Converts SQS records to platform-agnostic message format
 * 3. Calls the platform-agnostic service
 * 4. Returns partial batch failure report to SQS
 */

import type { SQSHandler } from 'aws-lambda'
import { createEnvFactory, createLogger, optionalEnv } from '@local-packages/common-utils'
import { processLiquidationMessage } from '@local-service/liquidator'

const logger = createLogger({ service: 'liquidator-lambda' })

/**
 * Lambda handler entry point
 */
export const handler: SQSHandler = async (event) => {
  // Create env factory with cached SSM parameters
  // The createEnvFactory caches SSM params across warm Lambda invocations
  const env = await createEnvFactory({
    SEED_PHRASE: optionalEnv('SEED_PHRASE_PARAM'),
  })

  const batchItemFailures: { itemIdentifier: string }[] = []

  // Process all records in the batch
  const promises = event.Records.map(async (record) => {
    try {
      // Convert SQS record to platform-agnostic format
      const result = await processLiquidationMessage({
        messageId: record.messageId,
        body: record.body,
      }, logger)

      if (!result.success) {
        batchItemFailures.push({ itemIdentifier: record.messageId })
      }
    }
    catch (error) {
      // Unexpected error - mark as failed for retry
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
