export async function fetchJson(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${url}`)
    }
    return await response.json()
  }
  finally {
    clearTimeout(timeout)
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value)
    throw new Error(`Missing required env var: ${name}`)
  return value
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value : undefined
}

export function normalizeUsdToXrd(usdPrice: string, xrdUsdPrice: string, scale: number): string {
  const numerator = parseDecimalToBigInt(usdPrice, scale)
  const denominator = parseDecimalToBigInt(xrdUsdPrice, scale)
  if (denominator === 0n) {
    throw new Error('XRD/USD price is zero')
  }

  const scaleFactor = 10n ** BigInt(scale)
  const normalized = (numerator * scaleFactor) / denominator
  return trimTrailingZeros(formatBigIntToDecimal(normalized, scale))
}

function trimTrailingZeros(value: string): string {
  if (!value.includes('.'))
    return value
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '')
  return trimmed.length === 0 ? '0' : trimmed
}

function parseDecimalToBigInt(value: string, scale: number): bigint {
  const raw = value.trim()
  const negative = raw.startsWith('-')
  const [whole = '0', fraction = ''] = (negative ? raw.slice(1) : raw).split('.')
  const normalizedWhole = whole.length === 0 ? '0' : whole
  const normalizedFraction = fraction.replace(/\D/g, '')

  if (!/^\d+$/.test(normalizedWhole) || (normalizedFraction && !/^\d+$/.test(normalizedFraction))) {
    throw new Error(`Invalid decimal value: ${value}`)
  }

  const fractionPadded = (normalizedFraction + '0'.repeat(scale)).slice(0, scale)
  const combined = normalizedWhole + fractionPadded
  const bigintValue = BigInt(combined || '0')
  return negative ? -bigintValue : bigintValue
}

function formatBigIntToDecimal(value: bigint, scale: number): string {
  const negative = value < 0n
  const raw = (negative ? -value : value).toString()
  if (scale === 0)
    return `${negative ? '-' : ''}${raw}`

  const padded = raw.padStart(scale + 1, '0')
  const whole = padded.slice(0, -scale)
  const fraction = padded.slice(-scale)
  return `${negative ? '-' : ''}${whole}.${fraction}`
}
