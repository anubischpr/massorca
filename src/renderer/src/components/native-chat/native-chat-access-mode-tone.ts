import type { AgentSessionAccessMode } from '../../../../shared/agent-session-access-mode'

/** The risk colour of the access a chat runs with: warning for full access, success for Auto, and
 *  neutral for every other mode, including Ask for approval and a mode nothing says. */
export type NativeChatAccessTone = 'warning' | 'success' | 'neutral'

/** `inherit` takes the tone of what it resolves to, and stays neutral when this client cannot know. */
export function nativeChatAccessTone(
  value: string | undefined,
  inheritedAccess: AgentSessionAccessMode | undefined
): NativeChatAccessTone {
  const effective = value === 'inherit' ? inheritedAccess : value
  if (effective === 'full-access') {
    return 'warning'
  }
  return effective === 'auto' ? 'success' : 'neutral'
}
