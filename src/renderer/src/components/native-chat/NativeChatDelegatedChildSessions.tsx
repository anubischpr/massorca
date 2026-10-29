import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
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

export type DelegatedChildSessions = {
  running: readonly DelegatedChild[]
  finished: readonly DelegatedChild[]
}

const NO_CHILD_SESSIONS: DelegatedChildSessions = { running: [], finished: [] }

/** The chat's started child sessions, split once per journal change; `listed` false lists none. */
export function useDelegatedChildSessions(
  journalItems: readonly DelegatedChildJournalItem[] | undefined,
  listed = true
): DelegatedChildSessions {
  return useMemo(() => {
    if (!listed) {
      return NO_CHILD_SESSIONS
    }
    // Why: a request that never started has no child session to list; the chat's failed notice already says so.
    const started = delegatedChildrenFromJournal(journalItems ?? []).filter(
      (child) => child.status !== 'not-started'
    )
    return {
      running: started.filter((child) => child.status === 'working'),
      finished: started.filter((child) => child.status !== 'working')
    }
  }, [journalItems, listed])
}

/** The child sessions still working, listed above the other background sections. */
export function NativeChatDelegatedRunningChildSessions({
  sessions,
  now
}: {
  sessions: readonly DelegatedChild[]
  now: number
}): React.JSX.Element | null {
  const { t } = useTranslation()
  if (sessions.length === 0) {
    return null
  }
  return (
    <section aria-label={t('components.nativeChatBackground.childSessions', 'Child sessions')}>
      <h3 className="mb-2 font-medium text-muted-foreground">
        {t('components.nativeChatBackground.childSessions', 'Child sessions')}
      </h3>
      <ul className="space-y-2">
        {sessions.map((session) => (
          <NativeChatDelegatedChildRow key={session.requestId} session={session} now={now} />
        ))}
      </ul>
    </section>
  )
}

/** Settled child sessions, as rows of the Finished group that holds them. */
export function NativeChatDelegatedFinishedChildRows({
  sessions,
  now
}: {
  sessions: readonly DelegatedChild[]
  now: number
}): React.JSX.Element {
  return (
    <>
      {sessions.map((session) => (
        <NativeChatDelegatedChildRow key={session.requestId} session={session} now={now} />
      ))}
    </>
  )
}

/** One child session row, with an Open action where a tab lists its chat. */
export function NativeChatDelegatedChildRow({
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
