// Mobile port of desktop's pill labeling
// (src/renderer/src/components/native-chat/native-chat-session-option-labels.ts),
// minus i18n — mobile renders plain strings throughout.

import type {
  SessionOptionDescriptor,
  SessionOptionDisabledReason,
  SessionOptionNote,
  SessionOptionSelectChoice
} from '../../../src/shared/native-chat-session-options'

export function mobileSessionOptionDisabledReason(
  reason: SessionOptionDisabledReason | undefined
): string | null {
  // Exhaustive over SessionOptionDisabledReason so new keys are a compile error.
  switch (reason) {
    case 'set-when-session-starts':
      return 'Set when the session starts.'
    case 'available-after-session-start':
      return 'Available after the session starts.'
    case undefined:
      return null
  }
}

export function mobileSessionOptionNote(note: SessionOptionNote): string {
  // Exhaustive over SessionOptionNote, like the disabled-reason labels above.
  switch (note) {
    case 'no-restricted-mode':
      return 'Pi chat has no restricted mode.'
    case 'start-only-modes':
      return 'Dimmed modes can only be set when the session starts.'
    case 'applies-on-next-start':
      return 'Changes apply when the session next starts.'
  }
}

/** The label of the choice a select descriptor holds, or null when nothing reported one. */
export function mobileSelectedChoiceLabel(descriptor: SessionOptionDescriptor): string | null {
  if (
    descriptor.valueSource === 'unknown' ||
    descriptor.kind.type !== 'select' ||
    !descriptor.kind.currentValue
  ) {
    return null
  }
  const current = descriptor.kind.currentValue
  const choice: SessionOptionSelectChoice = descriptor.kind.choices.find(
    (candidate) => candidate.value === current
  ) ?? { value: current, label: current }
  return choice.label
}

/** Value-only pill text — the category lives on the sheet title, not the pill. */
export function mobileModelPillLabel(descriptor: SessionOptionDescriptor): string {
  return mobileSelectedChoiceLabel(descriptor) ?? descriptor.label
}

/** Sheet title; the access descriptor's internal id would read as "accessmode", so it has its own. */
export function mobileSessionOptionSheetTitle(descriptor: SessionOptionDescriptor): string {
  return descriptor.id === 'accessMode'
    ? 'Select access'
    : `Select ${descriptor.label.toLowerCase()}`
}

export function mobileSessionOptionSummaryValue(descriptor: SessionOptionDescriptor): string {
  // A boolean always has a value, so the summary states it and lets the sheet's
  // marker say whether anything confirmed it. Reading "Not set" here while the
  // sheet showed the switch on made the two screens disagree.
  if (descriptor.kind.type === 'boolean') {
    return descriptor.kind.currentValue ? 'On' : 'Off'
  }
  if (descriptor.valueSource === 'unknown') {
    return 'Not set'
  }
  return mobileSelectedChoiceLabel(descriptor) ?? 'Not set'
}
