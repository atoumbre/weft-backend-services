import Decimal from 'decimal.js'

Decimal.set({ precision: 50, rounding: Decimal.ROUND_DOWN, toExpNeg: -50, toExpPos: 50 })

export const dec = (input: any): Decimal => new Decimal(input)

export const ZERO = dec(0)
export const ONE = dec(1)
export const ONE_HUNDRED = dec(100)

export const PRECISE_ZERO = dec(0)
export const PRECISE_ONE = dec(1)
export const PRECISE_ONE_HUNDRED = dec(100)

export function toCamelCase(str: string): string {
  return str
    .split('_')
    .map((word: string, index: number) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join('')
}

export function findIndexes<T>(arr: T[], predicate: (element: T) => boolean): number[] {
  const indexes: number[] = []

  arr.forEach((element, index) => {
    if (predicate(element)) {
      indexes.push(index)
    }
  })

  return indexes
}
