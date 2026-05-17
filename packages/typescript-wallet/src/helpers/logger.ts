export interface ILogger {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
  fatal?: (message: any, ...args: any[]) => void
  child: (bindings: Record<string, any>) => ILogger
}

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
}

let configuredLogger: ILogger = noopLogger

export function configureWalletLogger(logger: ILogger | null | undefined) {
  configuredLogger = logger ?? noopLogger
}

export function resetWalletLogger() {
  configuredLogger = noopLogger
}

export function getWalletLogger() {
  return configuredLogger
}

export const walletLogger: ILogger = {
  debug: (message, ...args) => configuredLogger.debug(message, ...args),
  info: (message, ...args) => configuredLogger.info(message, ...args),
  warn: (message, ...args) => configuredLogger.warn(message, ...args),
  error: (message, ...args) => configuredLogger.error(message, ...args),
  fatal: (message, ...args) => configuredLogger.fatal?.(message, ...args),
  child: bindings => configuredLogger.child(bindings),
}
