import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

export const EFFORT_METER_BARS = 5

/** Bars lit for the selected effort: its place in the choice list, scaled onto the bars. Zero when nothing is selected. */
export function effortMeterLevel(descriptor: SessionOptionDescriptor): number {
  if (descriptor.kind.type !== 'select') {
    return 0
  }
  const { choices, currentValue } = descriptor.kind
  const index = choices.findIndex((choice) => choice.value === currentValue)
  if (index === -1) {
    return 0
  }
  return Math.max(1, Math.round(((index + 1) / choices.length) * EFFORT_METER_BARS))
}
