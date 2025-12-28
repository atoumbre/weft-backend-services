https://docs.weft.finance/dev/liquidation-guide

NFT Liquidation

Requires liquidating one NFT per call.
If the NFT’s value exceeds the loan, the liquidator must compensate for the difference in XRD.
The liquidator also pays a bonus in XRD for NFTs.
View Sample NFT Liquidation Transaction: https://stokenet-dashboard.radixdlt.com/transaction/txid_tdx_2_1dlf9fenztah93gdv3p2dgduhdg794krazxwjkn3rgf7u6tyl0lsqt6puzx/summary

```
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "lock_fee"
    Decimal("10")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "take_flash_loan"
    Map<Address, Decimal>(
        Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc") => Decimal("6380.934579439252646068")
    )
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "withdraw"
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("315.887850467289734954")
;
TAKE_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("87.22741433021807361")
    Bucket("bucket1")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Bucket("bucket2")
;
CALL_METHOD
    Address("component_tdx_2_1crgmz63jqnkzuwq3trghh9tlgtqnr3uyt7c006sfcw6xdr0c2q8tng")
    "swap"
    Bucket("bucket2")
    Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w")
    Bucket("bucket3")
;
CALL_METHOD
    Address("component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57")
    "liquidate_nft"
    NonFungibleLocalId("#790#")
    Array<Bucket>(
        Bucket("bucket3")
    )
    Address("resource_tdx_2_1nf2eptx9ajuxkgr6g6aagxrvcuh480hca8kwrc2684xp3y44s5askz")
    NonFungibleLocalId("{4f58711db673a4c9-6adbac61e9e44239-c4eed16a71cde45e-94d8eb22e1ee9c85}")
    Bucket("bucket1")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1nf2eptx9ajuxkgr6g6aagxrvcuh480hca8kwrc2684xp3y44s5askz")
    Bucket("bucket4")
;
CALL_METHOD
    Address("validator_tdx_2_1s0l6946a2kx33vjmuuh3qrax3ueauznd2fc3d69md2exx29rcnjmnj")
    "claim_xrd"
    Bucket("bucket4")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Bucket("bucket5")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d")
    Bucket("bucket6")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "repay_flash_loan"
    Array<Bucket>(
        Bucket("bucket5")
    )
    Bucket("bucket6")
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
```

LSU Liquidation

Involves Liquid Staking Units, requiring additional XRD to cover specific conditions.
View Sample LSU Liquidation Transaction:

```
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "lock_fee"
    Decimal("10")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "take_flash_loan"
    Map<Address, Decimal>(
        Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur") => Decimal("72.279107")
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
    Bucket("bucket1")
;
CALL_METHOD
    Address("component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57")
    "liquidate"
    NonFungibleLocalId("#1006#")
    Array<Bucket>(
        Bucket("bucket1")
    )
    Enum<1u8>(
        Array<Address>(
            Address("resource_tdx_2_1thjlp88pc28eyfg3f2alq8zkggnr273j0saye4nj70vfnga6ldy7ru")
        )
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1thjlp88pc28eyfg3f2alq8zkggnr273j0saye4nj70vfnga6ldy7ru")
    Bucket("bucket2")
;
CALL_METHOD
    Address("validator_tdx_2_1svwenmn2mkwf9vu5kegs9seql5j535rc3ddjcvg9v3j4d7lvnya70k")
    "unstake"
    Bucket("bucket2")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1nglf548yxudgkc2kgtcs56fhm5g33hm3x66c00zvnkg74n3nj7w8gg")
    Bucket("bucket3")
;
TAKE_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("0")
    Bucket("bucket4")
;
CALL_METHOD
    Address("component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57")
    "create_cdp"
    Bucket("bucket4")
    Enum<1u8>(
        "Liquidator_638677670501790857"
    )
    Enum<0u8>()
    Enum<0u8>()
    Array<Bucket>()
    Array<Bucket>(
        Bucket("bucket3")
    )
    Map<Address, Decimal>(
        Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc") => Decimal("4102.192499548905236355")
    )
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "withdraw"
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Decimal("302.266815756235122679")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc")
    Bucket("bucket5")
;
CALL_METHOD
    Address("component_tdx_2_1crgmz63jqnkzuwq3trghh9tlgtqnr3uyt7c006sfcw6xdr0c2q8tng")
    "swap"
    Bucket("bucket5")
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
    Bucket("bucket6")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d")
    Bucket("bucket7")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "repay_flash_loan"
    Array<Bucket>(
        Bucket("bucket6")
    )
    Bucket("bucket7")
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;

```

Fungible Collateral Liquidation

Handles tokens or other fungible assets.
View Sample Fungible Collateral Liquidation Transaction:

````
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "lock_fee"
    Decimal("10")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "take_flash_loan"
    Map<Address, Decimal>(
        Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w") => Decimal("30.4638885")
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w")
    Bucket("bucket1")
;
CALL_METHOD
    Address("component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57")
    "liquidate"
    NonFungibleLocalId("#22#")
    Array<Bucket>(
        Bucket("bucket1")
    )
    Enum<1u8>(
        Array<Address>(
            Address("resource_tdx_2_1thf8h2npjhfp8jeqc4tq20yxm4j3cnwd0urpg0dsg2cy56yjn0n388")
        )
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1thf8h2npjhfp8jeqc4tq20yxm4j3cnwd0urpg0dsg2cy56yjn0n388")
    Bucket("bucket2")
;
CALL_METHOD
    Address("component_tdx_2_1crgmz63jqnkzuwq3trghh9tlgtqnr3uyt7c006sfcw6xdr0c2q8tng")
    "swap"
    Bucket("bucket2")
    Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tkenhqw8aq05fm7m50ckg6f7whsfw8l2kqs0hprx8dncxmefv9lf2w")
    Bucket("bucket3")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d")
    Bucket("bucket4")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "repay_flash_loan"
    Array<Bucket>(
        Bucket("bucket3")
    )
    Bucket("bucket4")
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;

````

Deposit Unit Liquidation

Involves liquidating shares from lending pools.
View Sample Deposit Unit Liquidation Transaction:

````
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "lock_fee"
    Decimal("10")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "take_flash_loan"
    Map<Address, Decimal>(
        Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur") => Decimal("138.202637498658883699")
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
    Bucket("bucket1")
;
CALL_METHOD
    Address("component_tdx_2_1czjla2sp8uamjaex0mtt65xtztyhtyk02wv0lxntz90qtst6w0kf57")
    "liquidate"
    NonFungibleLocalId("#849#")
    Array<Bucket>(
        Bucket("bucket1")
    )
    Enum<1u8>(
        Array<Address>(
            Address("resource_tdx_2_1t4n8nrufknhskx5pqk2gq39hn0uat3u3ztydk7y6e0duh5jsthzfk2")
        )
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1t4n8nrufknhskx5pqk2gq39hn0uat3u3ztydk7y6e0duh5jsthzfk2")
    Bucket("bucket2")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "withdraw"
    Array<Bucket>(
        Bucket("bucket2")
    )
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1t4w276lkyvvs8rfym22q37dh7jsn7tlhue0c3shjuchlqtm0jugx4s")
    Bucket("bucket3")
;
CALL_METHOD
    Address("component_tdx_2_1crgmz63jqnkzuwq3trghh9tlgtqnr3uyt7c006sfcw6xdr0c2q8tng")
    "swap"
    Bucket("bucket3")
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1tk903dr7agsg65v8h8he6kdhwlsctedxq0fuec0aufagr2xeyhs5ur")
    Bucket("bucket4")
;
TAKE_ALL_FROM_WORKTOP
    Address("resource_tdx_2_1n2507ke7qsjggtwqwe6cghep669wlcrvv3t7gxvmxy75lms8ezza7d")
    Bucket("bucket5")
;
CALL_METHOD
    Address("component_tdx_2_1crrha0f0s7gayclln3f2s4xmpz3ja5lph2prmavkdsfwc05sun0t8t")
    "repay_flash_loan"
    Array<Bucket>(
        Bucket("bucket4")
    )
    Bucket("bucket5")
;
CALL_METHOD
    Address("account_tdx_2_16yll6clntk9za0wvrw0nat848uazduyqy635m8ms77md99q7yf9fzg")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;

```
