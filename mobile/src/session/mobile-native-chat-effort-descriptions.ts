import type { SessionOptionDescriptor } from '../../../src/shared/native-chat-session-options'

/** One line on what an effort level means for a reply; null when the level is unknown. */
export function mobileEffortDescription(value: string): string | null {
  switch (value) {
    case 'minimal':
      return 'Fastest replies, almost no thinking'
    case 'low':
      return 'Quick replies, minimal thinking'
    case 'medium':
      return 'Balanced thinking'
    case 'high':
      return 'Thinks longer before answering'
    case 'xhigh':
      return 'For hard, multi-step problems'
    case 'max':
      return 'Deepest reasoning, slowest'
    case 'ultra':
      return 'Maximum reasoning budget'
    default:
      return null
  }
}

/** The effort descriptor with each known level described; unknown levels stay as they were. */
export function mobileEffortDescriptorWithDescriptions(
  descriptor: SessionOptionDescriptor
): SessionOptionDescriptor {
  if (descriptor.kind.type !== 'select') {
    return descriptor
  }
  return {
    ...descriptor,
    kind: {
      ...descriptor.kind,
      choices: descriptor.kind.choices.map((choice) => {
        const description = mobileEffortDescription(choice.value)
        return description ? { ...choice, description } : choice
      })
    }
  }
}
