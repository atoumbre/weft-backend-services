/**
 * AWS Lambda Wrapper for Price Updater Service
 *
 * This is the platform-specific entry point that:
 * 1. Retrieves secrets from AWS SSM and sets them as env vars
 * 2. Reads configuration from environment variables
 * 3. Calls the platform-agnostic price update service
 */

import { randomUUID } from 'node:crypto'
import { createEnvFactory, createLogger, optionalEnv } from '@local-packages/common-utils'
import { buildManifest, executePriceUpdate } from '@local-service/price-updater'

const logger = createLogger({ service: 'oracle-updater' })

// Initialize EnvFactory promise at the global scope to ensure it starts fetching
// immediately while remaining compatible with CommonJS.
const envPromise = createEnvFactory({
  SEED_PHRASE: optionalEnv('SEED_PHRASE_PARAM'),
})

/**
 * Lambda handler entry point
 */
export async function handler() {
  const env = await envPromise
  const runId = randomUUID()
  const startedAt = Date.now()
  const localLogger = logger.child({ runId })

  // Read configuration from EnvFactory
  const accountAddress = env.require('ACCOUNT_ADDRESS')
  const badgeResourceAddress = env.require('BADGE_RESOURCE_ADDRESS')
  const oracleComponentAddress = env.require('ORACLE_COMPONENT_ADDRESS')
  const badgeId = env.optional('BADGE_NFT_ID') ?? '#1#'

  const pythBaseUrl = env.optional('PYTH_HERMES_URL') ?? 'https://hermes.pyth.network'
  const coingeckoBaseUrl = env.optional('COINGECKO_BASE_URL') ?? 'https://api.coingecko.com'
  const caviarnineBaseUrl = env.optional('CAVIARNINE_BASE_URL') ?? 'https://api.caviarnine.com'
  const astrolescentBaseUrl = env.optional('ASTROLESCENT_BASE_URL') ?? 'https://api.astrolescent.com/partner/R96v1uADor/prices'
  const timeoutMs = Number(env.optional('PRICE_FETCH_TIMEOUT_MS') ?? '5000')
  const maxPriceAgeSec = env.optional('PYTH_MAX_AGE_SEC')

  try {
    // Call the platform-agnostic service
    const { prices, xrdUsdPrice } = await executePriceUpdate({
      config: {
        pythBaseUrl,
        coingeckoBaseUrl,
        caviarnineBaseUrl,
        astrolescentBaseUrl,
        timeoutMs,
        maxPriceAgeSec: maxPriceAgeSec ? Number(maxPriceAgeSec) : undefined,
      },
      logger: localLogger,
    })

    // Build the transaction manifest
    const manifest = buildManifest({
      accountAddress,
      badgeResourceAddress,
      badgeId,
      oracleComponentAddress,
      prices,
    })

    const sourceBreakdown = prices.reduce((acc: Record<string, number>, p: any) => {
      acc[p.source] = (acc[p.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    localLogger.info({
      event: 'oracle.manifest.ready',
      priceCount: prices.length,
      successfulAssets: prices.map((p: any) => p.symbol),
      sourceBreakdown,
      xrdUsdPrice,
      durationMs: Date.now() - startedAt,
      manifestLength: manifest.length,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        runId,
        prices,
        manifest,
      }),
    }
  }
  catch (error) {
    localLogger.error({ event: 'oracle.failed', err: error })
    throw error
  }
}
