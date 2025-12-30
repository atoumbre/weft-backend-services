export const LENDING_POOL_COMPONENT = 'component_rdx1czmr02yl4da709ceftnm9dnmag7rthu0tu78wmtsn5us9j02d9d0xn'
export const LENDING_MARKET_COMPONENT = 'component_rdx1cpy6putj5p7937clqgcgutza7k53zpha039n9u5hkk0ahh4stdmq4w'
export const WEFT_STAKING_COMPONENT = 'component_rdx1cqzle2pft0y09kwzaxy07maczpwmka9xknl88glwc4ka6a7xavsltd'

export const LENDING_POOL_INTEREST_STRATEGY_KVS = 'internal_keyvaluestore_rdx1krx5aq2h74pdyj99r3rpztr2ahvd9xdtfcfujrm079zw279sse68ck'
export const LENDING_POOL_RESOURCE_POOL_KVS = 'internal_keyvaluestore_rdx1kzjr763caq96j0kv883vy8gnf3jvrrp7dfm9zr5n0akryvzsxvyujc'
export const LENDING_POOL_SERVICE_KVS = 'internal_keyvaluestore_rdx1krz350jhmvvuw2cctslmg3axnxagqas4muf5rxvfd8jcqru7s4v9a3'

export const LENDING_MARKET_PRICE_CACHE_KVS = 'internal_keyvaluestore_rdx1krnvw2lrk6jdhemskgsjldjahq2aatvycpwuuccaap93880hr2s0dh'
export const LENDING_MARKET_RES_CONFIG_KVS = 'internal_keyvaluestore_rdx1kr89xu06dc83cqvevjs22hg202pkm4xmh5qeka29rc94r2af7vc55n'
export const LENDING_MARKET_COLLATERAL_CONFIG_KVS = 'internal_keyvaluestore_rdx1krp789s9vy4rny9c6wsm2hs3nxgxxnhafxs2t2lv9qpkdze6rna8qe'
export const LENDING_MARKET_LOAN_CONFIG_KVS = 'internal_keyvaluestore_rdx1kqhrmxz9dltruje0z2flxy86v9gm58vs38y3kjqxcazhy63z94zmre'
export const LENDING_MARKET_EFFICIENT_GROUP_KVS = 'internal_keyvaluestore_rdx1kpcw9se76zuryjp2ju7jl3xk9mea32fgj7w83mxq8tx0fgl8a4w7mc'
export const LENDING_MARKET_LOAN_SERVICE_KVS = 'internal_keyvaluestore_rdx1krqp74wz473l3d7v08m3v66kv46fe03aq5retc7hhy7ha9vgedfha7'
export const LENDING_MARKET_COLLATERAL_SERVICE_KVS = 'internal_keyvaluestore_rdx1kzsa48ew4vwj7l3y0wdxkkgz6lrrg50lyultllruqzaqawkesf2gre'

export const CDP_RESOURCE = 'resource_rdx1nt22yfvhuuhxww7jnnml5ec3yt5pkxh0qlghm6f0hz46z2wfk80s9r'
export const WEFT_RESOURCE = 'resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3'
export const XUSDC_RESOURCE = 'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf'

export const PROTOCOL_INTEREST_SHARE = 0.2
export const STAKEHOLDER_REWARD_SHARE = 0.5

export const resourceToDuMapping = new Map<string, { interestModel: string, du: string }>([
  ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', { interestModel: '1', du: 'resource_rdx1th0gjs665xgm343j4jee7k8apu8l8pg9cf8x587qprszeeknu8wsxz' }], // XRD
  ['resource_rdx1thksg5ng70g9mmy9ne7wz0sc7auzrrwy7fmgcxzel2gvp8pj0xxfmf', { interestModel: '1', du: 'resource_rdx1t4p82pms6r20k87rscms728tekujacd0sgxyysk7yvl0jgf56gvjuc' }], // LSULP

  ['resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf', { interestModel: '0', du: 'resource_rdx1thw2u4uss739j8cqumehgf5wyw26chcfu98newsu42zhln7wd050ee' }], // xUSDC
  ['resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw', { interestModel: '0', du: 'resource_rdx1t5ljp8amkf76mrn5txmmemkrmjwt5r0ajjnljvyunh27gm0n295dfn' }], // xUSDT
  ['resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75', { interestModel: '2', du: 'resource_rdx1thyes252jplxhu8qvfx6k3wkmlhy2f09nfqqefuj2a73l79e0af99t' }], // xWBTC
  ['resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww', { interestModel: '2', du: 'resource_rdx1t456hgpk6kwn4lqut5p2mqqmuuwngzhwxlgyyk9dwv4t5hmp37d7xf' }], // xETH

  ['resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv', { interestModel: '0', du: 'resource_rdx1t4kxe9n00hgzng02myj6a320qxcma2umxj8ygr795cc5m0hsj3p4l2' }], // hUSDC
  ['resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe', { interestModel: '0', du: 'resource_rdx1t48fy4e7d0zfzkky5yxvgaxvewp65ecv49vtccyawlulhegk3sw7kz' }], // hUSDT
  ['resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5', { interestModel: '2', du: 'resource_rdx1t4y98gg8r4mvlaf6tyut0natx874er06qy84ct3d5dvg0c3j2d6d4s' }], // hWBTC
  ['resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0', { interestModel: '2', du: 'resource_rdx1t5tcgsd0m6ptqsd0g70xu08tzdhy23ml5ql9xlmmv9wpchg3lw7dtk' }], // hETH
  ['resource_rdx1t5ljlq97xfcewcdjxsqld89443fchqg96xv8a8k8gdftdycy9haxpx', { interestModel: '2', du: 'resource_rdx1th9rpfyjcuu8w0hypaf4l3ywy26n6nt8hsavuksmjthcyc8unmlccc' }], // hSOL
])

export const duToResourceMapping = new Map([...resourceToDuMapping].map(([k, v]) => [v.du, k]))

export const defaultLendingPools = [...resourceToDuMapping.keys()]
