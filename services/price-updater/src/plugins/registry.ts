import type { PriceFeedPlugin } from './types'

export class PluginRegistry {
  private plugins = new Map<string, PriceFeedPlugin>()

  register(plugin: PriceFeedPlugin): void {
    this.plugins.set(plugin.name, plugin)
  }

  get(name: string): PriceFeedPlugin | undefined {
    return this.plugins.get(name)
  }

  has(name: string): boolean {
    return this.plugins.has(name)
  }

  keys(): string[] {
    return Array.from(this.plugins.keys())
  }

  entries(): [string, PriceFeedPlugin][] {
    return Array.from(this.plugins.entries())
  }
}
