import type { TransactionPreviewRequest } from '@radixdlt/babylon-gateway-api-sdk'

export function createBaseTransactionParams(): TransactionPreviewRequest {
  return {
    manifest: '',
    start_epoch_inclusive: 1,
    end_epoch_exclusive: 255,
    tip_percentage: 0,
    nonce: 1234567890,
    signer_public_keys: [{
      key_type: 'EcdsaSecp256k1',
      key_hex: '02a1b3f9482e376b3e5fd2f48a2c4a679c6cf2c8f7b2dd12c14f75d15df3ac59d1', // Random public key
    }],
    flags: {
      use_free_credit: true,
      assume_all_signature_proofs: true,
      skip_epoch_check: true,
    },
    opt_ins: {
      radix_engine_toolkit_receipt: true,
    },
  }
}
