import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

/** Lucide glyphs the access button can show; the button maps each name to its component. */
export type MobileAccessIconName = 'Lock' | 'LockKeyhole' | 'NotebookPen' | 'Eye' | 'LockOpen'

/** `caution` is Auto (amber) and `danger` is full access (red on a tint). */
export type MobileAccessTone = 'neutral' | 'caution' | 'danger'

export type MobileAccessDisplay = { icon: MobileAccessIconName; tone: MobileAccessTone }

/** Human access labels, ported from the desktop picker without i18n. */
export function mobileAccessChoiceLabel(value: string): string | null {
  switch (value) {
    case 'inherit':
      return 'Inherit global setting'
    case 'default':
      return 'Ask for approval'
    case 'auto':
      return 'Auto'
    case 'accept-edits':
      return 'Accept edits'
    case 'plan':
      return 'Plan'
    case 'read-only':
      return 'Read only'
    case 'full-access':
      return 'Full access'
    default:
      return null
  }
}

/** The access value in effect; a descriptor with no reported choice runs `inherit`, as on desktop. */
export function mobileAccessCurrentValue(descriptor: SessionOptionDescriptor): string {
  return descriptor.kind.type === 'select' ? (descriptor.kind.currentValue ?? 'inherit') : 'inherit'
}

/** `inherit` takes the look of the mode it resolves to, and the neutral lock when that is unknown. */
export function mobileAccessDisplay(
  value: string,
  inheritedAccess: SessionOptionDescriptor['inheritedAccess']
): MobileAccessDisplay {
  const effective = value === 'inherit' ? inheritedAccess : value
  switch (effective) {
    case 'full-access':
      return { icon: 'LockOpen', tone: 'danger' }
    case 'auto':
      return { icon: 'LockOpen', tone: 'caution' }
    case 'accept-edits':
      return { icon: 'LockKeyhole', tone: 'neutral' }
    case 'plan':
      return { icon: 'NotebookPen', tone: 'neutral' }
    case 'read-only':
      return { icon: 'Eye', tone: 'neutral' }
    default:
      return { icon: 'Lock', tone: 'neutral' }
  }
}

/** The access descriptor with human choice labels, so its sheet rows read like the desktop picker. */
export function mobileAccessDescriptorWithLabels(
  descriptor: SessionOptionDescriptor
): SessionOptionDescriptor {
  if (descriptor.kind.type !== 'select') {
    return descriptor
  }
  return {
    ...descriptor,
    kind: {
      ...descriptor.kind,
      choices: descriptor.kind.choices.map((choice) => ({
        ...choice,
        label: mobileAccessChoiceLabel(choice.value) ?? choice.label
      }))
    }
  }
}
