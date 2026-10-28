import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

/** Codex reports its standard tier as null or `default`; any other tier is a faster one. */
export function isDefaultServiceTier(tier: string | null | undefined): boolean {
  return tier === undefined || tier === null || tier === '' || tier === 'default'
}

/** Claude's `fastMode` switch, or Codex's `serviceTier` once it leaves the default tier. */
export function isMobileFastModeOn(options: readonly SessionOptionDescriptor[]): boolean {
  return options.some((descriptor) => {
    if (descriptor.valueSource === 'unknown') {
      return false
    }
    if (descriptor.id === 'fastMode') {
      return descriptor.kind.type === 'boolean' && descriptor.kind.currentValue === true
    }
    return (
      descriptor.id === 'serviceTier' &&
      descriptor.kind.type === 'select' &&
      !isDefaultServiceTier(descriptor.kind.currentValue)
    )
  })
}
