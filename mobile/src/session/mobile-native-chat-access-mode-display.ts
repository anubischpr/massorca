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

/** One line on what an access mode does; `inherit` names what it resolves to, when known. */
export function mobileAccessDescription(
  value: string,
  inheritedAccess: SessionOptionDescriptor['inheritedAccess']
): string | null {
  switch (value) {
    case 'inherit': {
      const resolved = inheritedAccess ? mobileAccessChoiceLabel(inheritedAccess) : null
      return resolved
        ? `Uses the global access setting (${resolved})`
        : 'Uses the global access setting'
    }
    case 'default':
      return 'Asks before edits and commands'
    case 'auto':
      return 'Decides on its own what needs approval'
    case 'accept-edits':
      return 'Edits files freely, asks before commands'
    case 'plan':
      return 'Plans first, no edits until you approve'
    case 'read-only':
      return 'Reads only, never edits or runs commands'
    case 'full-access':
      return 'Never asks. Runs anything.'
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
  // Why: `auto` is every agent's auto-equivalent, so the caution tone needs no per-agent table.
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

/** Access descriptor with human labels and one-line descriptions, as on the desktop picker. */
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
        label: mobileAccessChoiceLabel(choice.value) ?? choice.label,
        description:
          mobileAccessDescription(choice.value, descriptor.inheritedAccess) ?? choice.description
      }))
    }
  }
}
