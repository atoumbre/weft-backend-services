/**
 * AWS Lambda Wrapper for Price Updater Service
 *
 * This is the platform-specific entry point that:
 * 1. Retrieves secrets from AWS SSM and sets them as env vars
 * 2. Reads configuration from environment variables
 * 3. Calls the platform-agnostic price update service
 */

import { randomUUID } from 'node:crypto'
import { createLogger, getSSMParameter, optionalEnv, requireEnv } from '@local-packages/common-utils'
import { buildManifest, executePriceUpdate } from '@local-service/price-updater'

const logger = createLogger({ service: 'oracle-updater' })

/**
 * Lambda handler entry point
 */
export async function handler() {
  const runId = randomUUID()
  const startedAt = Date.now()
  const localLogger = logger.child({ runId })

  // Retrieve secrets from SSM and inject as environment variables
  const seedPhraseParamPath = requireEnv('SEED_PHRASE_PARAM')
  if (seedPhraseParamPath) {
    try {
      const seedPhrase = await getSSMParameter(seedPhraseParamPath)
      // Inject secret as environment variable for the service to use
      process.env.SEED_PHRASE = seedPhrase
      localLogger.info({
        event: 'oracle.ssm.seed_phrase_retrieved',
        path: seedPhraseParamPath,
        length: seedPhrase.length,
      })
    }
    catch (error) {
      localLogger.error({
        event: 'oracle.ssm.seed_phrase_failed',
        path: seedPhraseParamPath,
        err: error,
      })
    }
  }

  // Read configuration from environment variables
  const accountAddress = requireEnv('ACCOUNT_ADDRESS')
  const badgeResourceAddress = requireEnv('BADGE_RESOURCE_ADDRESS')
  const oracleComponentAddress = requireEnv('ORACLE_COMPONENT_ADDRESS')
  const badgeId = optionalEnv('BADGE_NFT_ID') ?? '#1#'

  const pythBaseUrl = optionalEnv('PYTH_HERMES_URL') ?? 'https://hermes.pyth.network'
  const coingeckoBaseUrl = optionalEnv('COINGECKO_BASE_URL') ?? 'https://api.coingecko.com'
  const caviarnineBaseUrl = optionalEnv('CAVIARNINE_BASE_URL') ?? 'https://api.caviarnine.com'
  const astrolescentBaseUrl = optionalEnv('ASTROLESCENT_BASE_URL') ?? 'https://api.astrolescent.com/partner/R96v1uADor/prices'
  const timeoutMs = Number(optionalEnv('PRICE_FETCH_TIMEOUT_MS') ?? '5000')
  const maxPriceAgeSec = optionalEnv('PYTH_MAX_AGE_SEC')

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
