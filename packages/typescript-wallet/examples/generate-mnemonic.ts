import { generateMnemonic } from '../src'
import { walletLogger } from '../src/helpers/logger'

walletLogger.debug({ a: generateMnemonic() })
