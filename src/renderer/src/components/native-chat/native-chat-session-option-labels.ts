import type {
  SessionOptionDescriptor,
  SessionOptionDisabledReason,
  SessionOptionNote,
  SessionOptionSelectChoice
} from '../../../../shared/native-chat-session-options'
import { translate } from '@/i18n/i18n'

export function nativeChatSessionOptionNote(note: SessionOptionNote): string {
  // Exhaustive over SessionOptionNote, like the disabled-reason labels below.
  switch (note) {
    case 'no-restricted-mode':
      return translate(
        'components.native-chat.composer.optionNote.noRestrictedMode',
        'Pi chat has no restricted mode.'
      )
    case 'start-only-modes':
      return translate(
        'components.native-chat.composer.optionNote.startOnlyModes',
        'Dimmed modes can only be set when the session starts.'
      )
    case 'applies-on-next-start':
      return translate(
        'components.native-chat.composer.optionNote.appliesOnNextStart',
        'Changes apply when the session next starts.'
      )
  }
}

export function nativeChatSessionOptionLabel(descriptor: SessionOptionDescriptor): string {
  switch (descriptor.id) {
    case 'model':
      return translate('components.native-chat.composer.model', 'Model')
    case 'effort':
      return translate('components.native-chat.composer.effort', descriptor.label)
    case 'fastMode':
      return translate('components.native-chat.composer.fastMode', 'Fast mode')
    case 'thinking':
      return translate('components.native-chat.composer.thinking', 'Thinking')
    case 'accessMode':
      return translate('components.native-chat.composer.accessMode', 'Access')
    default:
      return descriptor.label
  }
}

export function nativeChatSessionChoiceLabel(choice: SessionOptionSelectChoice): string {
  switch (choice.value) {
    case 'inherit':
      return translate(
        'components.native-chat.composer.accessModeValue.inherit',
        'Inherit global setting'
      )
    case 'default':
      return translate(
        'components.native-chat.composer.accessModeValue.default',
        'Ask for approval'
      )
    case 'auto':
      return translate('components.native-chat.composer.accessModeValue.auto', 'Auto')
    case 'accept-edits':
      return translate(
        'components.native-chat.composer.accessModeValue.acceptEdits',
        'Accept edits'
      )
    case 'plan':
      return translate('components.native-chat.composer.accessModeValue.plan', 'Plan')
    case 'read-only':
      return translate('components.native-chat.composer.accessModeValue.readOnly', 'Read only')
    case 'full-access':
      return translate('components.native-chat.composer.accessModeValue.fullAccess', 'Full access')
    case 'minimal':
      return translate('components.native-chat.composer.optionValue.minimal', 'Minimal')
    case 'low':
      return translate('components.native-chat.composer.optionValue.low', 'Low')
    case 'medium':
      return translate('components.native-chat.composer.optionValue.medium', 'Medium')
    case 'high':
      return translate('components.native-chat.composer.optionValue.high', 'High')
    case 'xhigh':
      return translate('components.native-chat.composer.optionValue.xhigh', 'Extra high')
    case 'max':
      return translate('components.native-chat.composer.optionValue.max', 'Max')
    case 'ultra':
      return translate('components.native-chat.composer.optionValue.ultra', 'Ultra')
    default:
      return choice.label
  }
}

export function nativeChatSessionOptionDisabledReason(
  reason: SessionOptionDisabledReason | undefined
): string | null {
  // Exhaustive over SessionOptionDisabledReason: a new key is a compile error
  // here, so the localized label can never silently drift from the producer.
  switch (reason) {
    case 'set-when-session-starts':
      return translate(
        'components.native-chat.composer.setWhenSessionStarts',
        'Set when the session starts.'
      )
    case 'available-after-session-start':
      return translate(
        'components.native-chat.composer.availableAfterSessionStarts',
        'Available after the session starts.'
      )
    case undefined:
      return null
  }
}

export function nativeChatModelPillLabel(descriptor: SessionOptionDescriptor): string {
  // Why: show the value only (Codex/Conductor style). "Model:" is redundant —
  // the control's aria-label/tooltip already names the category.
  // Only `unknown` withholds the value; a `default` source still names the model
  // the launch will use, so it renders like any observed one.
  if (
    descriptor.valueSource === 'unknown' ||
    descriptor.kind.type !== 'select' ||
    !descriptor.kind.currentValue
  ) {
    return translate('components.native-chat.composer.model', 'Model')
  }
  return nativeChatSessionChoiceLabel(
    descriptor.kind.choices.find((choice) => choice.value === descriptor.kind.currentValue) ?? {
      value: descriptor.kind.currentValue,
      label: descriptor.kind.currentValue
    }
  )
}

export function nativeChatOptionsPillTitle(
  descriptors: readonly SessionOptionDescriptor[]
): string {
  const effort = descriptors.find((descriptor) => descriptor.id === 'effort')
  // Why: an effort-backed group is primarily the effort picker, even when it also reports modes.
  return effort
    ? nativeChatSessionOptionLabel(effort)
    : translate('components.native-chat.composer.sessionOptions', 'Session options')
}

export function nativeChatOptionsPillLabel(
  descriptors: readonly SessionOptionDescriptor[]
): string {
  const effort = descriptors.find((descriptor) => descriptor.id === 'effort')
  const labels: string[] = []
  for (const descriptor of descriptors) {
    if (descriptor.valueSource === 'unknown') {
      continue
    }
    if (descriptor.kind.type === 'select' && descriptor.kind.currentValue) {
      const choice = descriptor.kind.choices.find(
        (candidate) => candidate.value === descriptor.kind.currentValue
      )
      labels.push(
        nativeChatSessionChoiceLabel(
          choice ?? {
            value: descriptor.kind.currentValue,
            label: descriptor.kind.currentValue
          }
        )
      )
    } else if (descriptor.kind.type === 'boolean' && descriptor.kind.currentValue === true) {
      labels.push(
        descriptor.id === 'fastMode'
          ? translate('components.native-chat.composer.optionValue.fast', 'Fast')
          : nativeChatSessionOptionLabel(descriptor)
      )
    }
  }
  // Why: value-only pill (no "Effort:" prefix) — category lives on the tooltip.
  if (labels.length > 0) {
    return labels.join(' · ')
  }
  if (effort) {
    return nativeChatSessionOptionLabel(effort)
  }
  return translate('components.native-chat.composer.options', 'Options')
}
