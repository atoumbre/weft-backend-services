import type { EnumTransformerPlugin, TupleTransformerPlugin } from '../../../state-fetcher/src/types'
import type { OperatingStatusValue } from '../types/common'
import { InterestStrategy } from '../models/interest-strategy'

export const interestStrategyPlugin: TupleTransformerPlugin<InterestStrategy> = {
  tupleName: 'InterestStrategy',
  parser: (tupleObject, _fetcher) => {
    const interestStrategy = new InterestStrategy(tupleObject.breakPoints ?? [], tupleObject.description)

    return interestStrategy
  },
}

export const serviceStatusStrategyPlugin: TupleTransformerPlugin<Record<string, OperatingStatusValue>> = {
  tupleName: 'ServiceStatus',
  parser: (tupleObject, _fetcher) => {
    return tupleObject._unnamedField0
  },
}

export const configAndServiceKeyPlugin: EnumTransformerPlugin<string> = {
  enumName: ['LendingServiceKey', 'LoanServiceKey', 'CollateralServiceKey', 'ConfigurationKey'],
  parser: (enumObject, _fetcher) => {
    const keyFirstPart = enumObject.variant_name ?? enumObject.variant_id

    const keySecondPart = (enumObject.fields[0]) ? `_${(enumObject.fields[0] as any).value}` : ''

    const key = `${keyFirstPart}${keySecondPart}`

    return key
  },
}

export const servicePlugin: EnumTransformerPlugin<string> = {
  enumName: ['LendingService', 'LoanService', 'CollateralService', 'MarketService'],
  parser: (enumObject, _fetcher) => {
    return enumObject.variant_name!
  },
}
