import { AlertCircle, Check, CornerDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useNow } from '@/hooks/use-now'
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
import type { DelegatedChild } from '../../../../shared/delegated-children'
import { delegatedAgentLabel, delegatedDurationText } from './delegated-child-copy'
import { useDelegatedChild } from './delegated-children-context'

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
  const child = useDelegatedChild(payload.requestId)
  if (child?.status === 'working') {
    return <WorkingNotice payload={payload} child={child} />
  }
  const details = startDetails(payload)
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

/** A started child whose journal shows it still running: a live row with a way into the child. */
function WorkingNotice({
  payload,
  child
}: {
  payload: DelegationStartedPayload
  child: DelegatedChild
}): React.JSX.Element {
  const now = useNow(60_000)
  const childWorktreeId = useAppStore((state) =>
    findStructuredAgentSessionWorktreeId(state.unifiedTabsByWorktree, payload.childSessionId)
  )
  const details = `${startDetails(payload)}${payload.automatic ? ' (Automatic)' : ''}`
  const elapsed =
    child.startedAt === null ? null : delegatedDurationText(Math.max(0, now - child.startedAt))
  const heading = translate(
    'components.native-chat.delegation.working',
    'Child session working: {{title}}',
    { title: payload.title }
  )
  const detailLine =
    elapsed === null
      ? details
      : translate(
          'components.native-chat.delegation.workingDetails',
          '{{details}} · started {{elapsed}} ago',
          { details, elapsed }
        )
  return (
    <section
      aria-label={heading}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 shadow-xs"
    >
      <span
        role="img"
        aria-label={translate('components.native-chat.delegation.workingStatus', 'Working')}
        className="size-2 shrink-0 rounded-full bg-muted-foreground"
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="break-words text-sm font-medium text-foreground">{heading}</p>
        <p className="break-words text-xs text-muted-foreground">{detailLine}</p>
      </div>
      {childWorktreeId !== null ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            activateStructuredAgentSessionById({
              worktreeId: childWorktreeId,
              sessionId: payload.childSessionId
            })
          }}
        >
          {translate('components.native-chat.delegation.openChild', 'Open child chat')}
        </Button>
      ) : null}
    </section>
  )
}

function startDetails(payload: DelegationStartedPayload): string {
  return [
    delegatedAgentLabel(payload.agent),
    payload.model ?? translate('components.native-chat.delegation.defaultModel', 'default model'),
    payload.effort
  ]
    .filter((part): part is string => part !== null)
    .join(' · ')
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
  const duration = delegatedDurationText(payload.durationMs)
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
