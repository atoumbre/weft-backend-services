import type Decimal from 'decimal.js'
import * as scryptoValue from './scrypto-value'

export class Manifest {
  instructions: string[]

  constructor(instructions: string[]) {
    this.instructions = instructions
  }

  public toString(): string {
    return this.instructions.join('\n')
  }
}

export class ManifestBuilder {
  private readonly instructions: string[]
  private readonly buckets: Map<string, number>
  private readonly proofs: Map<string, number>
  private id_allocator: number

  constructor() {
    this.instructions = []
    this.buckets = new Map<string, number>()
    this.proofs = new Map<string, number>()
    this.id_allocator = 512
  }

  /**
   * Take all the given resource from worktop.
   *
   * @param resourceAddress The resource address
   * @param amount the amount
   * @param bucketName The name of the new bucket
   * @returns ManifestBuilder
   */
  takeFromWorktop(
    resourceAddress: scryptoValue.ResourceAddressString,
    amount: Decimal,
    bucketName: string,
  ): ManifestBuilder {
    this.instructions.push(
      `TAKE_FROM_WORKTOP ${scryptoValue.ResourceAddress(resourceAddress)} ${scryptoValue.Decimal(amount.toString())} ${scryptoValue.Bucket(
        bucketName,
      )};`,
    )
    this.buckets.set(bucketName, this.id_allocator++)
    return this
  }

  /**
   * Take all the given resource from worktop.
   *
   * @param resourceAddress The resource address
   * @param bucketName The name of the new bucket
   * @returns ManifestBuilder
   */
  takeAllFromWorktop(resourceAddress: scryptoValue.ResourceAddressString, bucketName: string): ManifestBuilder {
    this.instructions.push(`TAKE_ALL_FROM_WORKTOP ${scryptoValue.ResourceAddress(resourceAddress)} ${scryptoValue.Bucket(
      bucketName,
    )};`)
    this.buckets.set(bucketName, this.id_allocator++)
    return this
  }

  /**
   * Calls a function on a blueprint.
   *
   * @param packageAddress  The package address
   * @param blueprintName  The blueprint name
   * @param functionName  The function name
   * @param args The arguments, which must be in manifest format, e.g. `1u8`, `"string"`, `Bucket("name")`
   */
  callFunction(
    packageAddress: scryptoValue.PackageAddressString,
    blueprintName: string,
    functionName: string,
    args: string[],
  ): ManifestBuilder {
    this.instructions.push(
      `CALL_FUNCTION ${scryptoValue.PackageAddress(
        packageAddress,
      )} "${blueprintName}" "${functionName}" ${args.join(' ')};`,
    )
    return this
  }

  /**
   * Calls a method on a component.
   *
   * @param componentAddress  The component address
   * @param methodName The method name
   * @param args The arguments, which must be in manifest format, e.g. `1u8`, `"string"`, `Bucket("name")`
   * @returns ManifestBuilder
   */
  callMethod(
    componentAddress: scryptoValue.ComponentAddressString,
    methodName: string,
    args: string[],
  ): ManifestBuilder {
    this.instructions.push(
      `CALL_METHOD ${scryptoValue.ComponentAddress(
        componentAddress,
      )} "${methodName}" ${args.join(' ')};`,
    )
    return this
  }

  /**
   * Calls a method on a component.
   *
   * @param componentAddress  The component address
   * @param methodName The method name
   * @param args The arguments, which must be in manifest format, e.g. `1u8`, `"string"`, `Bucket("name")`
   * @returns ManifestBuilder
   */
  callMetadataMethod(
    componentAddress: scryptoValue.ComponentAddressString | scryptoValue.ResourceAddressString,
    methodName: string,
    args: string[],
  ): ManifestBuilder {
    this.instructions.push(
      `CALL_METADATA_METHOD ${scryptoValue.ComponentAddress(
        componentAddress,
      )} "${methodName}" ${args.join(' ')};`,
    )
    return this
  }

  /**
   * Creates a composite proof from the auth zone with all the given resource.
   *
   * @param resourceAddress The resource address
   * @param proofName The name of the new proof
   * @returns ManifestBuilder
   */
  createProofFromAuthZone(
    resourceAddress: scryptoValue.ResourceAddressString,
    proofName: string,
  ): this {
    this.instructions.push(
      `CREATE_PROOF_FROM_AUTH_ZONE ${scryptoValue.ResourceAddress(resourceAddress)} ${scryptoValue.Proof(
        proofName,
      )};`,
    )
    this.proofs.set(proofName, this.id_allocator++)
    return this
  }

  createProofFromAuthZoneOfNonFungibles(
    resourceAddress: string,
    ids: string[],
    proofName: string,
  ): this {
    this.instructions.push(
      `CREATE_PROOF_FROM_AUTH_ZONE_OF_NON_FUNGIBLES  ${scryptoValue.ResourceAddress(resourceAddress as scryptoValue.ResourceAddressString)} 
       Array<NonFungibleLocalId>(${ids.map(o => `NonFungibleLocalId("${o}")`).join(' , ')})  ${scryptoValue.Proof(proofName)};`,
    )

    this.proofs.set(proofName, this.id_allocator++)
    return this
  }

  /**
   * Pops the most recent proof from the auth zone.
   *
   * @param proofName The name of the new proof
   * @returns ManifestBuilder
   */
  popFromAuthZone(proofName: string): this {
    this.instructions.push(`POP_FROM_AUTH_ZONE ${scryptoValue.Proof(proofName)};`)
    this.proofs.set(proofName, this.id_allocator++)
    return this
  }

  createProofFromWorktop(resourceAddress: string, proofName: string): this {
    const bucketName = `bucket_${proofName}`

    this.instructions.push(
      `TAKE_ALL_FROM_WORKTOP  ${scryptoValue.ResourceAddress(resourceAddress as scryptoValue.ResourceAddressString)} ${scryptoValue.Bucket(bucketName)};`,
    )

    this.instructions.push(
      `CREATE_PROOF_FROM_BUCKET_OF_ALL ${scryptoValue.Bucket(bucketName)} ${scryptoValue.Proof(proofName)};`,
    )

    this.instructions.push(
      `POP_FROM_AUTH_ZONE ${scryptoValue.Proof(proofName)};`,
    )

    return this
  }

  /**
   * Builds a transaction manifest.
   *
   * @returns a transaction manifest
   */
  build(): Manifest {
    return new Manifest(this.instructions)
  }
}
