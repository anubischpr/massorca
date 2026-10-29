import { Activity, Bot, CircleHelp, SquareTerminal, Workflow } from 'lucide-react-native'
import type { AgentSessionBackgroundTask } from '../../../src/shared/agent-session-wire'
import { AGENT_WORKING_COLOR } from '../components/AgentStateDot'
import { colors } from '../theme/mobile-theme'

type TaskKind = AgentSessionBackgroundTask['kind']

/** The marker for one kind of background work: a subagent, a shell, a monitor, a workflow, or unknown. */
export function BackgroundTaskKindIcon({
  kind,
  size
}: {
  kind: TaskKind
  size: number
}): React.JSX.Element {
  const props = { size, color: kindIconColor(kind), strokeWidth: 2 }
  switch (kind) {
    case 'agent':
      return <Bot {...props} />
    case 'command':
      return <SquareTerminal {...props} />
    case 'monitor':
      return <Activity {...props} />
    case 'workflow':
      return <Workflow {...props} />
    case 'unknown':
      return <CircleHelp {...props} />
  }
}

// Monitoring is drawn in the same amber everywhere it shows; the other kinds are plain markers.
function kindIconColor(kind: TaskKind): string {
  return kind === 'monitor' ? AGENT_WORKING_COLOR : colors.textMuted
}
