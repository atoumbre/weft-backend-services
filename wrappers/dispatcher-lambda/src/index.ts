/**
 * AWS Lambda Wrapper for Dispatcher Service
 *
 * This is the platform-specific entry point that:
 * 1. Initializes AWS SDK clients
 * 2. Creates adapters implementing the service interfaces
 * 3. Injects dependencies into the platform-agnostic service
 */

import type { QueueBatchSender } from '@local-service/dispatcher'
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { createSimpleEnvFactory } from '@local-packages/common-utils'
import { createDispatcherHandler } from '@local-service/dispatcher'
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { WeftLedgerSateFetcher } from '@weft-finance/ledger-state'

// Lazy initialization for Lambda warm starts
let cachedHandler: (() => Promise<{ statusCode: number, body: string }>) | undefined

const env = createSimpleEnvFactory()

/**
 * Creates an SQS adapter implementing the QueueBatchSender interface.
 */
function createSqsAdapter(sqs: SQSClient, queueUrl: string): QueueBatchSender {
  return {
    async sendBatch(entries) {
      const response = await sqs.send(new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      }))

      const failed = response.Failed ?? []
      // Only return non-sender faults for retry
      const retryableFailures = failed
        .filter(item => !item.SenderFault)
        .map(item => item.Id!)

      // Log sender faults (these won't be retried)
      const senderFaults = failed.filter(item => item.SenderFault)
      if (senderFaults.length > 0) {
        console.error('SQS sender faults:', senderFaults.map(f => f.Id))
      }

      return { failed: retryableFailures }
    },
  }
}

function getHandler() {
  if (cachedHandler) {
    return cachedHandler
  }

  // Initialize AWS SDK clients
  const sqs = new SQSClient({})
  const indexerQueueUrl = env.require('INDEXER_QUEUE_URL')

  // Initialize Radix Gateway API client
  const gatewayApi = GatewayApiClient.initialize({
    basePath: env.require('RADIX_GATEWAY_URL'),
    applicationName: 'Weft Indexer Dispatcher',
  })

  // Initialize fetcher
  const fetcher = WeftLedgerSateFetcher.setInstance(gatewayApi)

  // Create platform adapter
  const queueSender = createSqsAdapter(sqs, indexerQueueUrl)

  // Create and cache the handler with injected dependencies
  cachedHandler = createDispatcherHandler({
    queueSender,
    fetcher,
    indexerBatchSize: Number.parseInt(env.require('INDEXER_BATCH_SIZE'), 10),
    env,
  })

  return cachedHandler
}

/**
 * Lambda handler entry point
 */
export const handler = async () => getHandler()()
