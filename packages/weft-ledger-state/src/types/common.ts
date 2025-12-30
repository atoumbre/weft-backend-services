import type { KeyValueStore } from '../../../state-fetcher/src/owned-entity/key-value-store'

export declare interface OperatingStatusValue {
  enabled: boolean
  locked: boolean
}

// export declare interface ServiceStatus<S extends string> {
//   services: Record<S, OperatingStatusValue>
// }

export declare interface ServiceManager<K extends string, S extends string> {
  entries: KeyValueStore<K, Record<S, OperatingStatusValue>>
}

export declare interface ConfigurationEntry<K extends string, T = any> {
  key: K
  entry: T
  version: number
  expirationTime: any
}

export declare interface ConfigurationManager<K extends string, T> {
  entryCount: number
  trackHistory: boolean
  entries: KeyValueStore<K, ConfigurationEntry<K, T>>
  versionCount: number
}
