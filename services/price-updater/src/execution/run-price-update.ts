import type { Result } from 'neverthrow'
import type { ILogger } from '../plugins/types'
import type { EnabledPriceSourcePlugins, PriceUpdateConfig } from '../pricing/resolve-prices'
import { getRadixEngineClient } from '@local-packages/typescript-wallet/transactions'

import { err, Result as NeverthrowResult, ok, okAsync, ResultAsync } from 'neverthrow'
import { executePriceUpdate } from '../pricing/resolve-prices'
import { buildManifest } from '../transactions/manifest'

export interface PriceUpdateResponse {
  runId: string
  prices: Awaited<ReturnType<typeof executePriceUpdate>>['prices']
  manifest: string
  dryRun: boolean
  submitted: boolean
  txId?: string
  transactionStatus?: string
}

export interface PriceUpdateError {
  step: string
  message: string
  cause: unknown
  stack?: string
}

export interface PriceUpdateRunnerConfig {
  badgeResourceAddress: string
  oracleComponentAddress: string
  badgeId: string
  networkName: NetworkName
  mnemonic: string
  derivationIndex: number
  dryRun: boolean
  pythBaseUrl: string
  coingeckoBaseUrl: string
  caviarnineBaseUrl: string
  astrolescentBaseUrl: string
  timeoutMs: number
  transactionFeeXrd: number
  maxPriceAgeSec?: number
  signedPayloadTtlSec: number
  disableCaviarNine: boolean
  disableCoinGecko: boolean
  disablePyth: boolean
  disableAstrolescent: boolean
  logLevel: string
}

export type NetworkName = Parameters<typeof getRadixEngineClient>[0]['networkName']
export type RadixEngineClient = ReturnType<typeof getRadixEngineClient>
export type TransactionStatusResponse = Awaited<ReturnType<RadixEngineClient['gatewayClient']['pollTransactionStatus']>> extends Result<infer T, unknown> ? T : never
export type WorkerConfig = PriceUpdateRunnerConfig
export type WorkerError = PriceUpdateError

export function toPriceUpdateError(step: string, cause: unknown): PriceUpdateError {
  return {
    step,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
    stack: cause && typeof cause === 'object' && 'stack' in cause ? String(cause.stack) : undefined,
  }
}

export const toWorkerError = toPriceUpdateError

export function getPriceUpdateFetchConfig(config: PriceUpdateRunnerConfig): PriceUpdateConfig {
  return {
    pythBaseUrl: config.pythBaseUrl,
    coingeckoBaseUrl: config.coingeckoBaseUrl,
    caviarnineBaseUrl: config.caviarnineBaseUrl,
    astrolescentBaseUrl: config.astrolescentBaseUrl,
    timeoutMs: config.timeoutMs,
    maxPriceAgeSec: config.maxPriceAgeSec,
  }
}

export function getEnabledPriceSourcePlugins(config: PriceUpdateRunnerConfig): EnabledPriceSourcePlugins {
  return {
    pyth: !config.disablePyth,
    caviarnine: !config.disableCaviarNine,
    coingecko: !config.disableCoinGecko,
    astrolescent: !config.disableAstrolescent,
  }
}

// Steps

/** Static params used for dry-run manifest previews — not real transaction epochs. */
const PREVIEW_TX_PARAMS = {
  START_EPOCH: 1,
  END_EPOCH: 255,
  NONCE: 1234567890,
  TIP_PERCENTAGE: 0,
} as const

function createRadixClient(params: {
  networkName: NetworkName
  mnemonic: string
  derivationIndex: number
}) {
  return NeverthrowResult.fromThrowable(
    () =>
      getRadixEngineClient({
        derivationIndex: params.derivationIndex,
        networkName: params.networkName,
        mnemonic: params.mnemonic,
      }),
    error => toPriceUpdateError('createRadixClient', error),
  )()
}

function previewManifest(params: {
  client: RadixEngineClient
  manifest: string
  logger: ILogger
}) {
  const { client, manifest, logger } = params

  logger.info({ step: 'previewTransaction start' })

  return client.gatewayClient
    .preview({
      manifest,
      start_epoch_inclusive: PREVIEW_TX_PARAMS.START_EPOCH,
      end_epoch_exclusive: PREVIEW_TX_PARAMS.END_EPOCH,
      tip_percentage: PREVIEW_TX_PARAMS.TIP_PERCENTAGE,
      nonce: PREVIEW_TX_PARAMS.NONCE,
      signer_public_keys: [{
        key_type: 'EddsaEd25519',
        key_hex: client.signerPublicKeyHex,
      }],
      flags: {
        use_free_credit: true,
        assume_all_signature_proofs: true,
        skip_epoch_check: true,
      },
      opt_ins: {
        radix_engine_toolkit_receipt: true,
      },
    })
    .mapErr(error => toPriceUpdateError('previewTransaction', error))
    .andThen((previewResult) => {
      const receiptStatus = previewResult.receipt && typeof previewResult.receipt === 'object' && 'status' in previewResult.receipt
        ? String(previewResult.receipt.status)
        : undefined

      const retReceiptKind = previewResult.radix_engine_toolkit_receipt
        && typeof previewResult.radix_engine_toolkit_receipt === 'object'
        && 'kind' in previewResult.radix_engine_toolkit_receipt
        ? String(previewResult.radix_engine_toolkit_receipt.kind)
        : undefined

      logger.debug({
        step: 'previewTransaction.raw',
        receiptStatus,
        retReceiptKind,
        receipt: previewResult.receipt,
        retReceipt: previewResult.radix_engine_toolkit_receipt,
      })

      if (receiptStatus === 'Succeeded' || retReceiptKind === 'CommitSuccess') {
        logger.info({ step: 'previewTransaction end', receiptStatus, retReceiptKind })
        return ok(previewResult)
      }

      return err(toPriceUpdateError(
        'previewTransaction',
        new Error(`Preview failed: ${JSON.stringify(previewResult.receipt ?? previewResult.radix_engine_toolkit_receipt)}`),
      ))
    })
}

function submitManifest(params: {
  client: RadixEngineClient
  manifest: string
  logger: ILogger
}) {
  const { client, manifest, logger } = params

  return client
    .convertStringManifest(manifest)
    .mapErr(error => toPriceUpdateError('convertManifest', error))
    .andThen(transactionManifest => client
      .submitTransaction(transactionManifest)
      .mapErr(error => toPriceUpdateError('submitTransaction', error)))
    .andThen((submission) => {
      logger.debug({
        step: 'transaction.submitted',
        txId: submission.txId,
      })

      return client.gatewayClient
        .pollTransactionStatus(submission.txId)
        .mapErr(error => toPriceUpdateError('pollTransactionStatus', error))
        .andThen((transactionStatus: TransactionStatusResponse | undefined) => {
          if (!transactionStatus) {
            return err(toPriceUpdateError(
              'pollTransactionStatus',
              new Error(`No terminal transaction status returned for ${submission.txId}`),
            ))
          }

          logger.debug({
            step: 'pollTransactionStatus.result',
            txId: submission.txId,
            transactionStatus,
          })

          return ok({
            txId: submission.txId,
            transactionStatus,
          })
        })
    })
    .map(({ txId, transactionStatus }) => {
      logger.info({
        step: 'submitTransaction end',
        txId,
        status: transactionStatus.status,
      })

      return {
        txId,
        transactionStatus: transactionStatus.status,
      }
    })
}

// Main price update function

export function runPriceUpdate(config: PriceUpdateRunnerConfig, logger: ILogger): ResultAsync<PriceUpdateResponse, PriceUpdateError> {
  const runId = crypto.randomUUID()
  const startedAt = Date.now()
  const localLogger = logger.child({ runId })

  // // 1. Get required config from env and validate it.
  // return getRequiredConfig(env)
  //   .asyncAndThen((config) => {

  return ResultAsync.fromPromise(
    (() => {
      const enabledPlugins = getEnabledPriceSourcePlugins(config)

      localLogger.debug('config.resolved', config)

      return executePriceUpdate({
        config: getPriceUpdateFetchConfig(config),
        logger: localLogger,
        enabledPlugins,
      })
    })(),

    error => toPriceUpdateError('executePriceUpdate', error),
  ).map((priceUpdate) => {
    localLogger.debug({
      step: 'priceUpdate.fetched',
      count: priceUpdate.prices.length,
      xrdUsdPrice: priceUpdate.xrdUsdPrice,
      prices: priceUpdate.prices.map(p => ({
        symbol: p.symbol,
        usdPrice: p.usdPrice,
        source: p.source,
      })),
    })
    return { config, priceUpdate }
  }).andThen(({ config, priceUpdate }) =>
    createRadixClient({
      networkName: config.networkName,
      mnemonic: config.mnemonic,
      derivationIndex: config.derivationIndex,
    }).map((client) => {
      localLogger.debug({
        step: 'radixClient.created',
        network: config.networkName,
        derivationIndex: config.derivationIndex,
      })
      return { client, priceUpdate, config }
    }),
  ).andThen(({ client, priceUpdate, config }) =>
    client.getAddresses()
      .map((addresses) => {
        localLogger.debug({
          step: 'addresses.resolved',
          accountAddress: addresses.accountAddress,
        })
        return { addresses, client, priceUpdate, config }
      })
      .mapErr(error => toPriceUpdateError('getAddresses', error)),
  ).andThen(({ addresses, client, priceUpdate, config }) =>
    NeverthrowResult.fromThrowable(
      () =>
        buildManifest({
          accountAddress: addresses.accountAddress,
          badgeResourceAddress: config.badgeResourceAddress,
          badgeId: config.badgeId,
          oracleComponentAddress: config.oracleComponentAddress,
          prices: priceUpdate.prices,
          transactionFee: config.transactionFeeXrd,
        }),
      error => toPriceUpdateError('buildManifest', error),
    )().map((manifest) => {
      localLogger.debug({
        step: 'manifest.built',
        manifestLength: manifest.length,
        manifestHead: manifest.slice(0, 200),
        manifestTail: manifest.slice(-200),
      })
      return { client, config, priceUpdate, manifest }
    }),
  ).andThen(({ client, priceUpdate, manifest, config }) =>
    previewManifest({ client, manifest, logger: localLogger })
      .map(() => ({ client, priceUpdate, manifest, config })),
  ).andThen(({ client, priceUpdate, manifest, config }) => {
    if (config.dryRun) {
      return okAsync({
        priceUpdate,
        manifest,
        dryRun: true,
        submitted: false,
        txId: undefined,
        transactionStatus: undefined,
      })
    }

    return submitManifest({ client, manifest, logger: localLogger })
      .map(({ txId, transactionStatus }) => ({
        priceUpdate,
        manifest,
        dryRun: false,
        submitted: true,
        txId,
        transactionStatus,
      }))
  }).map(({ priceUpdate, manifest, dryRun, submitted, txId, transactionStatus }) => {
    const sourceBreakdown = priceUpdate.prices.reduce<Record<string, number>>((acc, price) => {
      acc[price.source] = (acc[price.source] ?? 0) + 1
      return acc
    }, {})

    localLogger.info({
      event: submitted ? 'oracle.transaction.submitted' : 'oracle.transaction.dryRun',
      txId,
      status: transactionStatus,
      dryRun,
      submitted,
      priceCount: priceUpdate.prices.length,
      successfulAssets: priceUpdate.prices.map(price => price.symbol),
      sourceBreakdown,
      xrdUsdPrice: priceUpdate.xrdUsdPrice,
      durationMs: Date.now() - startedAt,
      manifestLength: manifest.length,
    })

    return {
      runId,
      prices: priceUpdate.prices,
      manifest,
      dryRun,
      submitted,
      txId,
      transactionStatus,
    }
  })
}
