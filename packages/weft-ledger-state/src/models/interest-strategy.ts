import type Decimal from 'decimal.js'
import { dec } from '../../../state-fetcher/src/utils'

export interface IsBreakPoint {
  usage: Decimal
  rate: Decimal
  slop: Decimal
}

export class InterestStrategy {
  description?: string
  breakPoints: IsBreakPoint[]

  constructor(breakPoints: IsBreakPoint[] = [], description?: string) {
    this.breakPoints = breakPoints
    this.description = description

    const maxInterestRate = this.getInterestRate(1)

    this.breakPoints.push({
      usage: dec(1),
      rate: dec(maxInterestRate),
      slop: dec(0),
    })
  }

  getChartPoints(pointCount: number = 500): { usage: number, rate: number }[] {
    return Array.from({ length: pointCount + 1 }, (_, i) => ({
      usage: +(i / pointCount * 100).toFixed(0),
      rate: +(this.getInterestRate(i / pointCount) * 100).toFixed(2),
    }))
  }

  getInterestRate(usage: number): number {
    if (usage < 0 || usage > 1) {
      throw new Error('Usage must be between 0 and 1, inclusive')
    }

    const len = this.breakPoints.length
    let j = len - 1

    for (let i = 0; i < len - 1; i++) {
      if (this.breakPoints[i]!.usage.toNumber() <= usage && usage < this.breakPoints[i + 1]!.usage.toNumber()) {
        j = i
        break
      }
    }

    const breakPoint = this.breakPoints[j]!

    const interestRate = breakPoint.rate.toNumber() + (usage - breakPoint.usage.toNumber()) * breakPoint.slop.toNumber()

    return interestRate
  }
}
