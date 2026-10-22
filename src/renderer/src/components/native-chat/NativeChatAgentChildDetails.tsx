import { useTranslation } from 'react-i18next'
import type { AgentChildRowModel } from '../../../../shared/agent-child-row-model'
import type { AgentChildWorkView } from '../../../../shared/agent-status-child-work-view'
import { formatAgentTypeLabel } from '../../../../shared/agent-type-label'
import { agentStateLabel } from '@/components/AgentStateDot'
import { recordedConfigurationText } from './native-chat-recorded-configuration'

const TASK_PREVIEW_MAX = 2_000

function elapsedLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1_000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

/** What a subagent child published about itself: role, configuration, state, timing, the task it
 *  was given and its latest or final message. A part the child did not report is left out. */
export function NativeChatAgentChildDetails(props: {
  row: AgentChildRowModel
  view: AgentChildWorkView | undefined
  now: number
}): React.JSX.Element {
  const { t } = useTranslation()
  const { row, view, now } = props
  const role = row.agentType ? formatAgentTypeLabel(row.agentType) : ''
  const configuration = recordedConfigurationText(row)
  const task = view?.description?.trim()
  const message = view?.lastMessage?.trim()
  const elapsed = elapsedLabel((row.settledAt ?? now) - row.firstObservedAt)
  const meta = [role && role !== row.name ? role : '', configuration].filter(Boolean).join(' · ')
  return (
    <section
      aria-label={t('components.nativeChatBackground.agentDetails', 'Subagent details')}
      className="space-y-2"
    >
      {meta ? <p className="text-muted-foreground">{meta}</p> : null}
      <p className="text-muted-foreground">
        {agentStateLabel(row.displayState)} ·{' '}
        {row.settled
          ? t('components.nativeChatBackground.ranFor', 'Ran for {{duration}}', {
              duration: elapsed
            })
          : t('components.nativeChatBackground.runningFor', 'Running for {{duration}}', {
              duration: elapsed
            })}
      </p>
      {task && task !== row.name ? (
        <div>
          <h3 className="font-medium text-muted-foreground">
            {t('components.nativeChatBackground.agentTask', 'Task')}
          </h3>
          <p className="whitespace-pre-wrap break-words">{task.slice(0, TASK_PREVIEW_MAX)}</p>
        </div>
      ) : null}
      {message ? (
        <div>
          <h3 className="font-medium text-muted-foreground">
            {row.settled
              ? t('components.nativeChatBackground.agentResult', 'Result')
              : t('components.nativeChatBackground.agentLatest', 'Latest')}
          </h3>
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>
      ) : null}
    </section>
  )
}
