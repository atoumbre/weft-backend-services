import type {
  NetworkName,
  PriceUpdateError,
  PriceUpdateRunnerConfig,
} from '../execution'
import type { ILogger } from '../plugins/types'
import { getRadixEngineClient } from '@local-packages/typescript-wallet/transactions'
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'
import { Result as NeverthrowResult, ResultAsync } from 'neverthrow'
import {
  getEnabledPriceSourcePlugins,
  getPriceUpdateFetchConfig,
  toPriceUpdateError,
} from '../execution'
import { executePriceUpdate } from '../pricing/resolve-prices'

const SIGNED_PAYLOAD_TYPE = 'weft.price_update'
const SIGNED_PAYLOAD_SCHEMA_VERSION = 1

export interface SignedPriceUpdatePayloadPrice {
  resourceAddress: string
  price: string
  publishTime: number
}

export interface SignedPriceUpdatePayload {
  schemaVersion: typeof SIGNED_PAYLOAD_SCHEMA_VERSION
  type: typeof SIGNED_PAYLOAD_TYPE
  networkId: number
  oracleComponentAddress: string
  issuedAtUnixMs: number
  expiresAtUnixMs: number
  prices: SignedPriceUpdatePayloadPrice[]
}

export interface SignedPriceUpdateResponse {
  runId: string
  payload: SignedPriceUpdatePayload
  payloadSborProgrammaticJson: unknown
  payloadSborHex: string
  signatureScheme: 'ed25519'
  publicKey: string
  signature: string
}

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

function sortValue(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(sortValue)

  if (!value || typeof value !== 'object')
    return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => [key, sortValue(entryValue)]),
  )
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0)
    throw new Error('Hex string must have an even length')

  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function toPriceUpdatePayloadSborProgrammaticJson(payload: SignedPriceUpdatePayload): unknown {
  return {
    kind: 'Tuple',
    fields: [
      { kind: 'U8', value: String(payload.schemaVersion) },
      { kind: 'String', value: payload.type },
      { kind: 'U8', value: String(payload.networkId) },
      { kind: 'Reference', value: payload.oracleComponentAddress },
      { kind: 'U64', value: String(payload.issuedAtUnixMs) },
      { kind: 'U64', value: String(payload.expiresAtUnixMs) },
      {
        kind: 'Array',
        element_kind: 'Tuple',
        elements: payload.prices.map(price => ({
          kind: 'Tuple',
          fields: [
            { kind: 'Reference', value: price.resourceAddress },
            { kind: 'Decimal', value: price.price },
            { kind: 'I64', value: String(price.publishTime) },
          ],
        })),
      },
    ],
  }
}

export function encodePriceUpdatePayloadSbor(payload: SignedPriceUpdatePayload): ResultAsync<{
  payloadSborProgrammaticJson: unknown
  payloadSborBytes: Uint8Array
  payloadSborHex: string
}, PriceUpdateError> {
  const payloadSborProgrammaticJson = toPriceUpdatePayloadSborProgrammaticJson(payload)

  return ResultAsync.fromPromise(
    RadixEngineToolkit.ScryptoSbor.encodeProgrammaticJson(payloadSborProgrammaticJson),
    error => toPriceUpdateError('encodePriceUpdatePayloadSbor', error),
  ).map(payloadSborBytes => ({
    payloadSborProgrammaticJson,
    payloadSborBytes,
    payloadSborHex: bytesToHex(payloadSborBytes),
  }))
}

export function createSignedPriceUpdate(
  config: PriceUpdateRunnerConfig,
  logger: ILogger,
): ResultAsync<SignedPriceUpdateResponse, PriceUpdateError> {
  const runId = crypto.randomUUID()
  const startedAt = Date.now()
  const localLogger = logger.child({ runId })

  return createRadixClient({
    networkName: config.networkName,
    mnemonic: config.mnemonic,
    derivationIndex: config.derivationIndex,
  }).asyncAndThen(client =>
    ResultAsync.fromPromise(
      executePriceUpdate({
        config: getPriceUpdateFetchConfig(config),
        logger: localLogger,
        enabledPlugins: getEnabledPriceSourcePlugins(config),
      }),
      error => toPriceUpdateError('executePriceUpdate', error),
    ).andThen((priceUpdate) => {
      const issuedAtMs = Date.now()
      const expiresAtMs = issuedAtMs + config.signedPayloadTtlSec * 1000
      const payload: SignedPriceUpdatePayload = {
        schemaVersion: SIGNED_PAYLOAD_SCHEMA_VERSION,
        type: SIGNED_PAYLOAD_TYPE,
        networkId: client.networkId,
        oracleComponentAddress: config.oracleComponentAddress,
        issuedAtUnixMs: issuedAtMs,
        expiresAtUnixMs: expiresAtMs,
        prices: priceUpdate.prices.map(price => ({
          resourceAddress: price.resourceAddress,
          price: price.price,
          publishTime: price.publishTime ?? 0,
        })),
      }

      return encodePriceUpdatePayloadSbor(payload)
        .andThen(({ payloadSborBytes, payloadSborHex, payloadSborProgrammaticJson }) =>
          client.signMessage(payloadSborBytes)
            .mapErr(error => toPriceUpdateError('signPriceUpdatePayload', error))
            .map(signature => ({ payloadSborHex, payloadSborProgrammaticJson, signature })),
        )
        .map(({ payloadSborHex, payloadSborProgrammaticJson, signature }) => {
          const sourceBreakdown = priceUpdate.prices.reduce<Record<string, number>>((acc, price) => {
            acc[price.source] = (acc[price.source] ?? 0) + 1
            return acc
          }, {})

          localLogger.info({
            event: 'oracle.price_payload.signed',
            priceCount: priceUpdate.prices.length,
            successfulAssets: priceUpdate.prices.map(price => price.symbol),
            sourceBreakdown,
            xrdUsdPrice: priceUpdate.xrdUsdPrice,
            durationMs: Date.now() - startedAt,
            expiresAtUnixMs: payload.expiresAtUnixMs,
          })

          return {
            runId,
            payload,
            payloadSborProgrammaticJson,
            payloadSborHex,
            signatureScheme: 'ed25519' as const,
            publicKey: client.signerPublicKeyHex,
            signature,
          }
        })
    }),
  )
}
