import { AlertCircle, Check, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog'
import {
  activateStructuredAgentSessionById,
  findStructuredAgentSessionWorktreeId
} from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import type {
  DelegationFailedPayload,
  DelegationFinishedPayload,
  DelegationNoticePayload,
  DelegationStartedPayload
} from '../../../../shared/delegated-session-journal'

/** A delegated session's start, failure or finish, drawn in the parent chat in place of its plain line. */
export function NativeChatDelegationNotice({
  payload
}: {
  payload: DelegationNoticePayload
}): React.JSX.Element {
  switch (payload.status) {
    case 'started':
      return <StartedNotice payload={payload} />
    case 'failed':
      return <FailedNotice payload={payload} />
    case 'finished':
      return <FinishedNotice payload={payload} />
  }
}

function StartedNotice({ payload }: { payload: DelegationStartedPayload }): React.JSX.Element {
  const details = [
    agentLabel(payload.agent),
    payload.model ?? translate('components.native-chat.delegation.defaultModel', 'default model'),
    payload.effort
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
  const values = { title: payload.title, details }
  const text = payload.automatic
    ? translate(
        'components.native-chat.delegation.startedAutomatic',
        'Started child session “{{title}}” with {{details}} (Automatic)',
        values
      )
    : translate(
        'components.native-chat.delegation.started',
        'Started child session “{{title}}” with {{details}}',
        values
      )
  return (
    <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
      <CornerDownRight aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p className="min-w-0 break-words">{text}</p>
    </div>
  )
}

function FailedNotice({ payload }: { payload: DelegationFailedPayload }): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm text-destructive">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 break-words">
        {translate(
          'components.native-chat.delegation.failed',
          'Child session “{{title}}” did not start: {{reason}}',
          { title: payload.title, reason: payload.reason }
        )}
      </p>
    </div>
  )
}

function FinishedNotice({ payload }: { payload: DelegationFinishedPayload }): React.JSX.Element {
  const succeeded = payload.outcome === 'succeeded'
  const childSessionId = payload.childSessionId
  // The child can sit in another worktree (a new child worktree), so look in every worktree.
  const childWorktreeId = useAppStore((state) =>
    childSessionId === null
      ? null
      : findStructuredAgentSessionWorktreeId(state.unifiedTabsByWorktree, childSessionId)
  )
  const heading = succeeded
    ? translate('components.native-chat.delegation.finished', 'Child session finished: {{title}}', {
        title: payload.title
      })
    : translate(
        'components.native-chat.delegation.failedFinish',
        'Child session failed: {{title}}',
        {
          title: payload.title
        }
      )
  const outcome = succeeded
    ? translate('components.native-chat.delegation.succeeded', 'succeeded')
    : translate('components.native-chat.delegation.outcomeFailed', 'failed')
  const duration = durationText(payload.durationMs)
  return (
    <section
      aria-label={heading}
      className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-start gap-2">
        {succeeded ? (
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
        ) : (
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        )}
        <p className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
          {heading}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground">
          {duration ? `${duration} · ${outcome}` : outcome}
        </span>
      </div>
      {payload.resultSummary ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {payload.resultSummary}
        </p>
      ) : null}
      {childSessionId !== null && childWorktreeId !== null ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              activateStructuredAgentSessionById({
                worktreeId: childWorktreeId,
                sessionId: childSessionId
              })
            }}
          >
            {translate('components.native-chat.delegation.openChild', 'Open child chat')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function agentLabel(agent: string): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

/** Whole minutes as the chat words them; null when the child never reported a duration. */
function durationText(durationMs: number | null): string | null {
  if (durationMs === null) {
    return null
  }
  const minutes = Math.floor(durationMs / 60_000)
  if (minutes < 1) {
    return translate('components.native-chat.delegation.underAMinute', 'under 1 min')
  }
  if (minutes < 60) {
    return translate('components.native-chat.delegation.minutes', '{{minutes}} min', { minutes })
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) {
    return translate('components.native-chat.delegation.hours', '{{hours}} h', { hours })
  }
  return translate(
    'components.native-chat.delegation.hoursMinutes',
    '{{hours}} h {{minutes}} min',
    {
      hours,
      minutes: rest
    }
  )
}
