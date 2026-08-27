// ============================================================================
// Asset Configuration
// ============================================================================

export interface AssetPriceFeed {
  plugin: string // Plugin name
  identifier?: string // Plugin-specific identifier
}

export interface AssetConfig {
  symbol: string
  resourceAddress: string
  fixedPriceXrd?: string
  priceFeeds: AssetPriceFeed[] // Ordered list (priority)
}

const CEX_XRD_USD_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'radix' },
  { plugin: 'kucoin', identifier: 'XRD-USDT' },
  { plugin: 'gateio', identifier: 'XRD_USDT' },
]

const MAJOR_ETH_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'ethereum' },
  { plugin: 'kucoin', identifier: 'ETH-USDT' },
  { plugin: 'gateio', identifier: 'ETH_USDT' },
  { plugin: 'caviarnine' },
  { plugin: 'astrolescent' },
]

const MAJOR_BTC_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'bitcoin' },
  { plugin: 'kucoin', identifier: 'BTC-USDT' },
  { plugin: 'gateio', identifier: 'BTC_USDT' },
  { plugin: 'caviarnine' },
  { plugin: 'astrolescent' },
]

const MAJOR_SOL_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'solana' },
  { plugin: 'kucoin', identifier: 'SOL-USDT' },
  { plugin: 'gateio', identifier: 'SOL_USDT' },
  { plugin: 'caviarnine' },
  { plugin: 'astrolescent' },
]

const MAJOR_USDC_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'usd-coin' },
  { plugin: 'kucoin', identifier: 'USDC-USDT' },
  { plugin: 'gateio', identifier: 'USDC_USDT' },
  { plugin: 'caviarnine' },
  { plugin: 'astrolescent' },
]

const USDT_FEEDS: AssetPriceFeed[] = [
  { plugin: 'coingecko', identifier: 'tether' },
  { plugin: 'caviarnine' },
  { plugin: 'astrolescent' },
]

function ecosystemFeeds(coingeckoId: string): AssetPriceFeed[] {
  return [
    { plugin: 'coingecko', identifier: coingeckoId },
    { plugin: 'caviarnine' },
    { plugin: 'astrolescent' },
  ]
}

export const ASSETS: AssetConfig[] = [
  {
    symbol: 'XRD',
    resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
    fixedPriceXrd: '1',
    priceFeeds: CEX_XRD_USD_FEEDS,
  },
  {
    symbol: 'xUSDT',
    resourceAddress: 'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw',
    priceFeeds: USDT_FEEDS,
  },
  {
    symbol: 'xUSDC',
    resourceAddress: 'resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf',
    priceFeeds: MAJOR_USDC_FEEDS,
  },
  {
    symbol: 'xETH',
    resourceAddress: 'resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww',
    priceFeeds: MAJOR_ETH_FEEDS,
  },
  {
    symbol: 'xwBTC',
    resourceAddress: 'resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75',
    priceFeeds: MAJOR_BTC_FEEDS,
  },
  {
    symbol: 'hUSDT',
    resourceAddress: 'resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe',
    priceFeeds: USDT_FEEDS,
  },
  {
    symbol: 'hUSDC',
    resourceAddress: 'resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv',
    priceFeeds: MAJOR_USDC_FEEDS,
  },
  {
    symbol: 'hETH',
    resourceAddress: 'resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0',
    priceFeeds: MAJOR_ETH_FEEDS,
  },
  {
    symbol: 'hWBTC',
    resourceAddress: 'resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5',
    priceFeeds: MAJOR_BTC_FEEDS,
  },
  {
    symbol: 'hSOL',
    resourceAddress: 'resource_rdx1t5ljlq97xfcewcdjxsqld89443fchqg96xv8a8k8gdftdycy9haxpx',
    priceFeeds: MAJOR_SOL_FEEDS,
  },

  // ecosystem token
  {
    symbol: 'WEFT',
    resourceAddress: 'resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3',
    priceFeeds: ecosystemFeeds('weft-finance'),
  },
  {
    symbol: 'HUG',
    resourceAddress: 'resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97',
    priceFeeds: ecosystemFeeds('hug'),
  },
  {
    symbol: 'EARLY',
    resourceAddress: 'resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s',
    priceFeeds: ecosystemFeeds('early'),
  },
  {
    symbol: 'OCI',
    resourceAddress: 'resource_rdx1t52pvtk5wfhltchwh3rkzls2x0r98fw9cjhpyrf3vsykhkuwrf7jg8',
    priceFeeds: ecosystemFeeds('ociswap'),
  },
  {
    symbol: 'ASTRL',
    resourceAddress: 'resource_rdx1t4tjx4g3qzd98nayqxm7qdpj0a0u8ns6a0jrchq49dyfevgh6u0gj3',
    priceFeeds: ecosystemFeeds('astrolescent'),
  },
  {
    symbol: 'DFP2',
    resourceAddress: 'resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq',
    priceFeeds: ecosystemFeeds('defiplaza'),
  },
  {
    symbol: 'CAVIAR',
    resourceAddress: 'resource_rdx1tkk83magp3gjyxrpskfsqwkg4g949rmcjee4tu2xmw93ltw2cz94sq',
    priceFeeds: ecosystemFeeds('caviar'),
  },
  {
    symbol: 'SRG',
    resourceAddress: 'resource_rdx1tka3kqqkjxcpddvcx0u300qt66z3tlzv7swqx9rklp60m5yqry6yzk',
    priceFeeds: ecosystemFeeds('surge-2'),
  },
  {
    symbol: 'FLOOP',
    resourceAddress: 'resource_rdx1t5pyvlaas0ljxy0wytm5gvyamyv896m69njqdmm2stukr3xexc2up9',
    priceFeeds: ecosystemFeeds('floop'),
  },
  {
    symbol: 'MOX',
    resourceAddress: 'resource_rdx1thmjcqjnlfm56v7k5g2szfrc44jn22x8tjh7xyczjpswmsnasjl5l9',
    priceFeeds: ecosystemFeeds('mox'),
  },
]

// resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd => XRD
// resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mqvfgvqjne940jv0lnrrg7rw => xUSDT
// resource_rdx1t4upr78guuapv5ept7d7ptekk9mqhy605zgms33mcszen8l9fac8vf => xUSDC
// resource_rdx1th88qcj5syl9ghka2g9l7tw497vy5x6zaatyvgfkwcfe8n9jt2npww => xETH
// resource_rdx1t580qxc7upat7lww4l2c4jckacafjeudxj5wpjrrct0p3e82sq4y75 => xwBTC
// resource_rdx1th4v03gezwgzkuma6p38lnum8ww8t4ds9nvcrkr2p9ft6kxx3kxvhe => hUSDT
// resource_rdx1thxj9m87sn5cc9ehgp9qxp6vzeqxtce90xm5cp33373tclyp4et4gv => hUSDC
// resource_rdx1th09yvv7tgsrv708ffsgqjjf2mhy84mscmj5jwu4g670fh3e5zgef0 => hETH
// resource_rdx1t58kkcqdz0mavfz98m98qh9m4jexyl9tacsvlhns6yxs4r6hrm5re5 => hWBTC
// resource_rdx1t5ljlq97xfcewcdjxsqld89443fchqg96xv8a8k8gdftdycy9haxpx => hSOL

// resource_rdx1tk3fxrz75ghllrqhyq8e574rkf4lsq2x5a0vegxwlh3defv225cth3 => WEFT
// resource_rdx1t5kmyj54jt85malva7fxdrnpvgfgs623yt7ywdaval25vrdlmnwe97 => HUG
// resource_rdx1t5xv44c0u99z096q00mv74emwmxwjw26m98lwlzq6ddlpe9f5cuc7s => EARLY
// resource_rdx1t52pvtk5wfhltchwh3rkzls2x0r98fw9cjhpyrf3vsykhkuwrf7jg8 => OCI
// resource_rdx1t40lchq8k38eu4ztgve5svdpt0uxqmkvpy4a2ghnjcxjtdxttj9uam => STAB
// resource_rdx1t4tjx4g3qzd98nayqxm7qdpj0a0u8ns6a0jrchq49dyfevgh6u0gj3 => ASTRL
// resource_rdx1t5ywq4c6nd2lxkemkv4uzt8v7x7smjcguzq5sgafwtasa6luq7fclq => DFP2
// resource_rdx1tkk83magp3gjyxrpskfsqwkg4g949rmcjee4tu2xmw93ltw2cz94sq => CAVIAR
// resource_rdx1tka3kqqkjxcpddvcx0u300qt66z3tlzv7swqx9rklp60m5yqry6yzk => SRG
// resource_rdx1t5pyvlaas0ljxy0wytm5gvyamyv896m69njqdmm2stukr3xexc2up9 => FLOOP
// resource_rdx1t58k9jlygcw27sx7peza34jtk65qhe8y7qxmyp9l09pz5sjgadkcq3 => xLINK
// resource_rdx1t4lqx3pzazlfp0e449ued6mmmfysevc8r2tzrcj70kpnlwt9kdpgf8 => xPEPE
// resource_rdx1t5d2qch32njedqpa204yswpxmxea5wazqf7tavptcxgq5j77suuxlr => xENA
// resource_rdx1thmjcqjnlfm56v7k5g2szfrc44jn22x8tjh7xyczjpswmsnasjl5l9 => MOX
