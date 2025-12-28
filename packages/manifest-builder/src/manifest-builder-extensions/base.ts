import type Decimal from 'decimal.js'
import type {
  ComponentAddressString,
  ResourceAddressString,
} from '../scrypto-value'

import { ManifestBuilder } from '../manifest-builder'
import {
  Bucket,
  Expression,
  Decimal as LibDecimal,
  ResourceAddress,
} from '../scrypto-value'

export type ManifestBuilderBaseExtensionConstructor = new (...args: any[]) => ManifestBuilderBaseExtension

export class ManifestBuilderBaseExtension extends ManifestBuilder {
  protected currentAccountAddress: string

  constructor(currentAccountAddress: string) {
    super()
    this.currentAccountAddress = currentAccountAddress
  }

  lockFee({ amount = 20 }: { amount?: number } = {}): this {
    this.callMethod(this.currentAccountAddress as ComponentAddressString, 'lock_fee', [LibDecimal(amount.toString())])
    return this
  }

  depositBatch(): this {
    this.callMethod(this.currentAccountAddress as ComponentAddressString, 'deposit_batch', [Expression('ENTIRE_WORKTOP')])
    return this
  }

  createSimpleNFTProof({
    accountAddress,
    resourceAddress,
    nonFungibleLocalIds,
  }: {
    accountAddress: string
    resourceAddress: string
    nonFungibleLocalIds: string[]
  }): this {
    this
      .callMethod(
        accountAddress as ComponentAddressString,
        'create_proof_of_non_fungibles',
        [
          ResourceAddress(resourceAddress as ResourceAddressString),
          `Array<NonFungibleLocalId>(${nonFungibleLocalIds.map(o => `NonFungibleLocalId("${o}")`).join(' , ')})`,
        ],
      )

    return this
  }

  withdrawFromAccount(input: {
    resourceAddress: string
    amount: Decimal
  }[]): void {
    for (let i = 0; i < (input.length ?? 0); i++) {
      const element = input[i]!
      this
        .callMethod(this.currentAccountAddress as ComponentAddressString, 'withdraw', [
          ResourceAddress(element.resourceAddress as ResourceAddressString),
          LibDecimal(element.amount.toString()),
        ])
    }
  }

  stake(validatorAddress: string, amount: Decimal | undefined, xrdResourceAddress: string): this {
    const buckets: string[] = this.buildBuckets('stake', [{ resourceAddress: xrdResourceAddress, amount }])

    this.callMethod(validatorAddress as ComponentAddressString, 'stake', [
      `${buckets[0]}`,
    ])

    return this
  }

  protected buildBuckets(bucketPrefixName: string, elements: {
    resourceAddress: string
    amount: Decimal | undefined
  }[]): string[] {
    const buckets: string[] = []
    for (let i = 0; i < (elements?.length ?? 0); i++) {
      const element = elements![i]

      if (element === undefined)
        continue

      const bucketName = `${bucketPrefixName}_${i}`
      const currentBucket = Bucket(bucketName)

      if (element.amount) {
        this
          .callMethod(this.currentAccountAddress as ComponentAddressString, 'withdraw', [
            ResourceAddress(element.resourceAddress as ResourceAddressString),
            LibDecimal(element.amount.toString()),
          ])
          .takeFromWorktop(element.resourceAddress as ResourceAddressString, element.amount, bucketName)
      }
      else {
        this.takeAllFromWorktop(element.resourceAddress as ResourceAddressString, bucketName)
      }

      buckets.push(currentBucket)
    }
    return buckets
  }

  protected buildSwapBuckets(): void {

  }

  protected buildNonFungibleBuckets(bucketPrefixName: string, elements: { resourceAddress: string, nftIds: string[] }[]): string[] {
    const buckets: string[] = []
    for (let i = 0; i < (elements?.length ?? 0); i++) {
      const element = elements![i]

      if (element === undefined)
        continue

      const bucketName = `${bucketPrefixName}_${i}`
      const currentBucket = Bucket(bucketName)

      this
        .callMethod(this.currentAccountAddress as ComponentAddressString, 'withdraw_non_fungibles', [
          ResourceAddress(element.resourceAddress as ResourceAddressString),
          `Array<NonFungibleLocalId>(${element.nftIds.map(o => `NonFungibleLocalId("${o}")`).join(' , ')})`,
        ])
        .takeAllFromWorktop(element.resourceAddress as ResourceAddressString, bucketName)

      buckets.push(currentBucket)
    }
    return buckets
  }
}
