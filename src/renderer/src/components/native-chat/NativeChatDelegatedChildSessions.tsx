import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/use-now'
import {
  activateStructuredAgentSessionById,
  findStructuredAgentSessionWorktreeId
} from '@/lib/structured-agent-session-tab-activation'
import { useAppStore } from '@/store'
import {
  delegatedChildrenFromJournal,
  type DelegatedChild,
  type DelegatedChildJournalItem
} from '../../../../shared/delegated-children'
import { delegatedChildStatusText } from './delegated-child-copy'
import { NativeChatFinishedBackgroundGroup } from './NativeChatFinishedBackgroundGroup'

/** The chat's child sessions, derived from its journal once per journal change. */
export function useDelegatedChildSessions(
  journalItems: readonly DelegatedChildJournalItem[] | undefined
): DelegatedChild[] {
  return useMemo(() => delegatedChildrenFromJournal(journalItems ?? []), [journalItems])
}

/** The child sessions this chat started: running ones first, settled ones under the Finished group. */
export function NativeChatDelegatedChildSessions({
  sessions,
  finishedOpen,
  onFinishedOpenChange
}: {
  sessions: readonly DelegatedChild[]
  finishedOpen: boolean
  onFinishedOpenChange: (open: boolean) => void
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const running = sessions.filter((session) => session.status === 'working')
  const finished = sessions.filter((session) => session.status !== 'working')
  const now = useNow(1_000, running.length > 0)
  if (sessions.length === 0) {
    return null
  }
  return (
    <>
      {running.length > 0 ? (
        <section aria-label={t('components.nativeChatBackground.childSessions', 'Child sessions')}>
          <h3 className="mb-2 font-medium text-muted-foreground">
            {t('components.nativeChatBackground.childSessions', 'Child sessions')}
          </h3>
          <ul className="space-y-2">
            {running.map((session) => (
              <ChildSessionRow key={session.requestId} session={session} now={now} />
            ))}
          </ul>
        </section>
      ) : null}
      {finished.length > 0 ? (
        <NativeChatFinishedBackgroundGroup
          count={finished.length}
          open={finishedOpen}
          onOpenChange={onFinishedOpenChange}
        >
          {finished.map((session) => (
            <ChildSessionRow key={session.requestId} session={session} now={now} />
          ))}
        </NativeChatFinishedBackgroundGroup>
      ) : null}
    </>
  )
}

function ChildSessionRow({
  session,
  now
}: {
  session: DelegatedChild
  now: number
}): React.JSX.Element {
  const { t } = useTranslation()
  const childSessionId = session.childSessionId
  // A new-child placement lives in another worktree, so look in every worktree.
  const childWorktreeId = useAppStore((state) =>
    childSessionId === null
      ? null
      : findStructuredAgentSessionWorktreeId(state.unifiedTabsByWorktree, childSessionId)
  )
  return (
    <li className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-foreground" title={session.title}>
          {session.title}
        </span>
        <span className="truncate text-muted-foreground">
          {delegatedChildStatusText(session, now)}
        </span>
      </div>
      {childSessionId !== null && childWorktreeId !== null ? (
        <Button
          variant="outline"
          size="xs"
          aria-label={t(
            'components.nativeChatBackground.openChildNamed',
            'Open child chat: {{title}}',
            {
              title: session.title
            }
          )}
          onClick={() => {
            activateStructuredAgentSessionById({
              worktreeId: childWorktreeId,
              sessionId: childSessionId
            })
          }}
        >
          {t('components.nativeChatBackground.openChild', 'Open')}
        </Button>
      ) : null}
    </li>
  )
}
