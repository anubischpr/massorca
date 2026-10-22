import { CircleStop } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { agentChildRowName } from '@/components/agent-child-row-text'
import { translate } from '@/i18n/i18n'
import type { AgentChildRowModel } from '../../../../shared/agent-child-row-model'
import { backgroundTaskRowStop } from '../../../../shared/background-task-roster'
import { sayBackgroundTaskTranslated as say } from './background-task-words-text'

/** What a background list is handed about stopping: what the host accepts and which tasks are mid-stop. */
export type NativeChatBackgroundStop = {
  /** Undefined from a host that predates the field, which draws no per-task Stop. */
  supportsTaskStop: boolean | undefined
  stoppingTaskIds: ReadonlySet<string>
  onStop: (taskId: string) => void
}

function unavailableReason(reason: 'provider' | 'row'): string {
  return reason === 'provider'
    ? translate(
        'components.nativeChatBackground.stopProviderUnavailable',
        'This provider cannot stop background tasks.'
      )
    : translate(
        'components.nativeChatBackground.stopRowUnavailable',
        'This task cannot be stopped on its own.'
      )
}

/** A live task's Stop icon: enabled when the host can stop that task, otherwise disabled with why. */
export function NativeChatBackgroundTaskStopControl(props: {
  row: AgentChildRowModel
  stop: NativeChatBackgroundStop
}): React.JSX.Element | null {
  const rowStop = backgroundTaskRowStop(props.row, props.stop.supportsTaskStop)
  if (rowStop.kind === 'none') {
    return null
  }
  const taskId = rowStop.kind === 'stop' ? rowStop.taskId : null
  const reason = rowStop.kind === 'unavailable' ? unavailableReason(rowStop.reason) : null
  const stopping = taskId !== null && props.stop.stoppingTaskIds.has(taskId)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button takes no pointer events, so the wrapper carries the reason's hover. */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={say('stopTask', { value0: agentChildRowName(props.row) })}
            aria-description={reason ?? undefined}
            disabled={reason !== null || stopping}
            onClick={() => {
              if (taskId !== null) {
                props.stop.onStop(taskId)
              }
            }}
          >
            <CircleStop className="size-3.5" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {reason ?? say('stop')}
      </TooltipContent>
    </Tooltip>
  )
}
