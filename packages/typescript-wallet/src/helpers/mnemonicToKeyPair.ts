import { getPublicKey, etc as ed25519Etc } from '@noble/ed25519'
import { hmac } from '@noble/hashes/hmac'
import { sha512 } from '@noble/hashes/sha512'
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import bip39 from 'bip39'
import { ok } from 'neverthrow'
import { secureRandom } from './secure-random'

const ED25519_CURVE = utf8ToBytes('ed25519 seed')
const HARDENED_OFFSET = 0x80000000
const pathRegex = /^m(\/[0-9]+')+$/

ed25519Etc.sha512Sync = (...messages: Uint8Array[]) => sha512(concatBytes(...messages))

export const generateMnemonic = () => bip39.entropyToMnemonic(secureRandom(32))

function mnemonicToSeed(mnemonic: string) {
  return ok(bip39.mnemonicToSeedSync(mnemonic).toString('hex'))
}

interface DerivedKey {
  key: Uint8Array
  chainCode: Uint8Array
}

function deriveMasterKey(seedHex: string): DerivedKey {
  const digest = hmac(sha512, ED25519_CURVE, hexToBytes(seedHex))

  return {
    key: digest.slice(0, 32),
    chainCode: digest.slice(32),
  }
}

function derivePrivateChild({ key, chainCode }: DerivedKey, index: number): DerivedKey {
  const indexBuffer = new Uint8Array(4)
  new DataView(indexBuffer.buffer).setUint32(0, index, false)

  const digest = hmac(
    sha512,
    chainCode,
    concatBytes(new Uint8Array(1), key, indexBuffer),
  )

  return {
    key: digest.slice(0, 32),
    chainCode: digest.slice(32),
  }
}

function derivePath(derivationPath: string, seedHex: string): DerivedKey {
  if (!pathRegex.test(derivationPath))
    throw new Error('Invalid derivation path')

  const segments = derivationPath
    .split('/')
    .slice(1)
    .map(segment => Number.parseInt(segment.replace('\'', ''), 10))

  return segments.reduce(
    (parentKey, segment) => derivePrivateChild(parentKey, segment + HARDENED_OFFSET),
    deriveMasterKey(seedHex),
  )
}

function deriveChildKey(derivationPath: string, seedHex: string) {
  return ok(derivePath(derivationPath, seedHex))
}

export function mnemonicToKeyPair(mnemonic: string, derivationPath: string) {
  return mnemonicToSeed(mnemonic)
    .andThen((seedHex: string) => deriveChildKey(derivationPath, seedHex))
    .map(({ key }) => ({
      privateKey: bytesToHex(key),
      publicKey: bytesToHex(getPublicKey(key)),
    }))
}
