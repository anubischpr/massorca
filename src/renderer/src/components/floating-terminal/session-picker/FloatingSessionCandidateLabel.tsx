import { defaultAgentChatLabel } from '../../../../../shared/agent-session-chat-label'
import { piRuntimeLabel } from '@/lib/pi-agent-display'
import { usePiDisplayRuntime } from '@/lib/use-pi-runtime'
import type { FloatingSessionCandidate } from './floating-session-picker-groups'

/** Gentle Shell keeps the agent id `pi`, so a chat still on its placeholder name is named from its host. */
export function FloatingSessionCandidateLabel({
  candidate
}: {
  candidate: Pick<FloatingSessionCandidate, 'agent' | 'label' | 'worktreeId'>
}): React.JSX.Element {
  const isPiPlaceholder =
    candidate.agent === 'pi' && candidate.label === defaultAgentChatLabel('pi')
  const piRuntime = usePiDisplayRuntime({
    enabled: isPiPlaceholder,
    worktreeId: candidate.worktreeId
  })
  const label = isPiPlaceholder ? `${piRuntimeLabel(piRuntime)} Chat` : candidate.label
  return <span className="min-w-0 flex-1 truncate">{label}</span>
}
