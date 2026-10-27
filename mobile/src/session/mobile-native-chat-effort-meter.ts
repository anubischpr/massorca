import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

export const EFFORT_METER_BARS = 5

/** Bars lit for one effort value, by its place in the choice list; zero when unlisted. */
export function effortMeterLevelForValue(
  descriptor: SessionOptionDescriptor,
  value: string | undefined
): number {
  if (descriptor.kind.type !== 'select' || value === undefined) {
    return 0
  }
  const { choices } = descriptor.kind
  const index = choices.findIndex((choice) => choice.value === value)
  if (index === -1) {
    return 0
  }
  return Math.max(1, Math.round(((index + 1) / choices.length) * EFFORT_METER_BARS))
}

/** Bars lit for the selected effort. Zero when nothing is selected. */
export function effortMeterLevel(descriptor: SessionOptionDescriptor): number {
  return effortMeterLevelForValue(
    descriptor,
    descriptor.kind.type === 'select' ? descriptor.kind.currentValue : undefined
  )
}
