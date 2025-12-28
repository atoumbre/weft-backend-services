/// <reference types="bun-types" />

import { ManifestBuilder, RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit'
import { expect, test } from 'bun:test'
import {
  liquidateDepositUnit,
  liquidateFungible,
  liquidateLsu,
  liquidateNft,
} from '../src/liquidation_lib'

const STOKENET_ID = 2

async function manifestToReadableString(builder: ManifestBuilder): Promise<string> {
  const manifest = builder.build()
  const instructions = await RadixEngineToolkit.Instructions.convert(
    manifest.instructions,
    STOKENET_ID,
    'String',
  )
  if (instructions.kind !== 'String') {
    throw new Error('Expected string instructions')
  }
  return instructions.value
}

test('liquidateNft generates expected manifest', async () => {
  const builder = new ManifestBuilder()
  const params = {
    accountAddress: 'account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg',
    poolAddress: 'component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t',
    liquidationCdpId: '#790#',
    debtResourceAddress: 'resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w',
    debtAmount: '6000',
    collateralNonFungibleAddress: 'resource_tdx_2_1nf2eptx9ajuxkgr6g6aagxrvcuh480hca8kwrc2684xp3y44s5askz',
    collateralNonFungibleId: '{4f58711db673a4c9-6adbac61e9e44239-c4eed16a71cde45e-94d8eb22e1ee9c85}',
    premiumAmount: '100',
  }

  const updatedBuilder = liquidateNft(builder, params)
  const manifestString = await manifestToReadableString(updatedBuilder)

  expect(manifestString).toContain('CALL_METHOD')
  expect(manifestString).toContain('take_flash_loan')
  expect(manifestString).toContain('liquidate_nft')
  expect(manifestString).toContain('repay_flash_loan')
  expect(manifestString).toContain(params.liquidationCdpId)
  expect(manifestString).toContain(params.collateralNonFungibleId)
})

test('liquidateLsu generates expected manifest', async () => {
  const builder = new ManifestBuilder()
  const params = {
    accountAddress: 'account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg',
    poolAddress: 'component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t',
    liquidationCdpId: '#1006#',
    debtResourceAddress: 'resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur',
    debtAmount: '72',
    lsuResourceAddress: 'resource_tdx_2_1thjlp88pc28eyfg3f2alq8zkggnr273j0saye4nj70vfnga6ldy7ru',
    validatorAddress: 'validator_tdx_2_1svwenmn2mkwf9vu5kegs9seql5j535rc3ddjcvg9v3j4d7lvnya70k',
  }

  const updatedBuilder = liquidateLsu(builder, params)
  const manifestString = await manifestToReadableString(updatedBuilder)

  expect(manifestString).toContain('take_flash_loan')
  expect(manifestString).toContain('liquidate')
  expect(manifestString).toContain('unstake')
  expect(manifestString).toContain('repay_flash_loan')
  expect(manifestString).toContain(params.liquidationCdpId)
  expect(manifestString).toContain(params.lsuResourceAddress)
})

test('liquidateFungible generates expected manifest', async () => {
  const builder = new ManifestBuilder()
  const params = {
    accountAddress: 'account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg',
    poolAddress: 'component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t',
    liquidationCdpId: '#22#',
    debtResourceAddress: 'resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w',
    debtAmount: '30.5',
    collateralResourceAddress: 'resource_tdx_2_1thf8h2npjhfp8jeqc4tq20yxm4j3cnwd0urpg0dsg2cy56yjn0n388',
  }

  const updatedBuilder = liquidateFungible(builder, params)
  const manifestString = await manifestToReadableString(updatedBuilder)

  expect(manifestString).toContain('take_flash_loan')
  expect(manifestString).toContain('liquidate')
  expect(manifestString).toContain('swap')
  expect(manifestString).toContain('repay_flash_loan')
  expect(manifestString).toContain(params.liquidationCdpId)
})

test('liquidateDepositUnit generates expected manifest', async () => {
  const builder = new ManifestBuilder()
  const params = {
    accountAddress: 'account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg',
    poolAddress: 'component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t',
    liquidationCdpId: '#849#',
    debtResourceAddress: 'resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur',
    debtAmount: '138',
    depositUnitResourceAddress: 'resource_tdx_2_1t4n8nrufknhskx5pqk2gq39hn0uat3u3ztydk7y6e0duh5jsthzfk2',
    lendingPoolAddress: 'component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t',
  }

  const updatedBuilder = liquidateDepositUnit(builder, params)
  const manifestString = await manifestToReadableString(updatedBuilder)

  expect(manifestString).toContain('take_flash_loan')
  expect(manifestString).toContain('liquidate')
  expect(manifestString).toContain('withdraw')
  expect(manifestString).toContain('swap')
  expect(manifestString).toContain('repay_flash_loan')
  expect(manifestString).toContain(params.liquidationCdpId)
})
