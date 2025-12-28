/**
 * Docker Container Wrapper for Indexer Service
 *
 * This is the platform-specific entry point that:
 * 1. Initializes AWS SDK clients
 * 2. Creates adapters implementing the service interfaces
 * 3. Injects dependencies into the platform-agnostic service
 * 4. Runs the polling loop
 */

import type { QueueReceiver, QueueSender, StorageWriter } from '@local-service/indexer'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs'
import { requireEnv } from '@local-packages/common-utils'
import { createIndexerWorker } from '@local-service/indexer'
import { GatewayApiClient } from '@radixdlt/babylon-gateway-api-sdk'
import { WeftLedgerSateFetcher } from '@weft-finance/ledger-state'

/**
 * Creates an SQS adapter implementing the QueueReceiver interface.
 */
function createSqsReceiver(sqs: SQSClient, queueUrl: string): QueueReceiver {
  return {
    async receive(maxMessages, waitTimeSeconds) {
      const response = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: waitTimeSeconds,
      }))
      return response.Messages ?? []
    },
    async delete(receiptHandle) {
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }))
    },
  }
}

/**
 * Creates an SQS adapter implementing the QueueSender interface.
 */
function createSqsSender(sqs: SQSClient, queueUrl: string): QueueSender {
  return {
    async sendBatch(entries) {
      await sqs.send(new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries,
      }))
    },
  }
}

/**
 * Creates an S3 adapter implementing the StorageWriter interface.
 */
function createS3Storage(s3: S3Client, bucketName: string): StorageWriter {
  return {
    async put(key, body, contentType) {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }))
    },
  }
}

async function main() {
  // Initialize AWS SDK clients
  const sqs = new SQSClient({})
  const s3 = new S3Client({})

  // Get configuration from environment
  const queueUrl = requireEnv('QUEUE_URL')
  const liquidationQueueUrl = requireEnv('LIQUIDATION_QUEUE_URL')
  const bucketName = requireEnv('BUCKET_NAME')

  // Initialize Radix Gateway API client
  const gatewayApi = GatewayApiClient.initialize({
    basePath: requireEnv('RADIX_GATEWAY_URL'),
    applicationName: 'Weft Indexer Worker',
  })

  // Initialize fetcher
  const fetcher = WeftLedgerSateFetcher.setInstance(gatewayApi)

  // Create platform adapters
  const queueReceiver = createSqsReceiver(sqs, queueUrl)
  const queueSender = createSqsSender(sqs, liquidationQueueUrl)
  const storage = createS3Storage(s3, bucketName)

  // Create and run the worker with injected dependencies
  const worker = createIndexerWorker({
    queueReceiver,
    queueSender,
    storage,
    fetcher,
    bucketName,
  })

  await worker.runForever()
}

// Check if this is the main module
const isMain = typeof require !== 'undefined' && require.main === module

if (isMain) {
  void main()
}

export { main }
