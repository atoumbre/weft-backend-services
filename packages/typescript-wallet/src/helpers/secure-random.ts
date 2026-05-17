import { bytesToHex, randomBytes } from '@noble/hashes/utils'

export function secureRandom(byteCount: number): string {
  return bytesToHex(randomBytes(byteCount))
}
