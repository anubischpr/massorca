import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Pin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../shared/constants'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session-journal-types'
import { Button } from '@/components/ui/button'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { formatAgentRowTypeLabel } from '../../../../../shared/agent-type-label'
import { useAppStore } from '@/store'
import { NativeChatChecklistBody } from '../../native-chat/NativeChatChecklistBody'
import { useNativeChatChecklist } from '../../native-chat/use-native-chat-checklist'
import { listFloatingSessionPickerGroups } from '../session-picker/floating-session-picker-groups'
import { FloatingSessionPicker } from '../session-picker/FloatingSessionPicker'
import { useFloatingChecklistPinStore } from './floating-checklist-pin'
import { readSessionJournalItems } from './floating-checklist-session-reader'
import {
  checklistTargetForSession,
  useFloatingChecklistSession
} from './use-floating-checklist-session'

// Why: the chat pane has a live journal, but a chat shown only here has none, so its replies are
// read again now and then; the person's own marks are polled by the checklist hook itself.
const JOURNAL_REFRESH_MS = 8_000
const NO_JOURNAL_ITEMS: readonly AgentJournalRenderItem[] = []

function useSessionJournalItems(sessionId: string | null): readonly AgentJournalRenderItem[] {
  const [read, setRead] = useState<{
    sessionId: string
    items: readonly AgentJournalRenderItem[]
  } | null>(null)
  useEffect(() => {
    const owner = sessionId ? checklistTargetForSession(sessionId) : null
    if (!sessionId || !owner) {
      return
    }
    let cancelled = false
    const load = (): void => {
      void readSessionJournalItems(owner.target, sessionId).then((items) => {
        if (!cancelled && items) {
          setRead({ sessionId, items })
        }
      })
    }
    load()
    const timer = setInterval(load, JOURNAL_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId])
  return read && read.sessionId === sessionId ? read.items : NO_JOURNAL_ITEMS
}

type SessionOwner = NonNullable<ReturnType<typeof checklistTargetForSession>>

function ChecklistHeader({
  tabId,
  owner,
  pinned,
  progress,
  progressBySession,
  requestProgress
}: {
  tabId: string
  owner: SessionOwner | null
  pinned: boolean
  progress: { checked: number; total: number } | null
  progressBySession: Readonly<Record<string, { checked: number; total: number } | null>>
  requestProgress: (sessionIds: readonly string[]) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const pin = useFloatingChecklistPinStore((s) => s.pin)
  const followFocus = useFloatingChecklistPinStore((s) => s.followFocus)
  const [pickerOpen, setPickerOpen] = useState(false)
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)

  // Why: read from the store at open and when a progress arrives, so the list is a snapshot.
  const groups = useMemo(
    () =>
      pickerOpen && unifiedTabsByWorktree
        ? listFloatingSessionPickerGroups(useAppStore.getState(), {
            layoutWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
            includeReferenced: true,
            accept: (candidate) =>
              candidate.sessionId !== null && progressBySession[candidate.sessionId] != null
          })
        : [],
    [pickerOpen, progressBySession, unifiedTabsByWorktree]
  )

  const onPickerOpenChange = (open: boolean): void => {
    setPickerOpen(open)
    if (open) {
      const everyChat = listFloatingSessionPickerGroups(useAppStore.getState(), {
        layoutWorktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        includeReferenced: true
      })
      requestProgress(
        everyChat.flatMap((group) =>
          group.candidates.flatMap((candidate) =>
            candidate.sessionId ? [candidate.sessionId] : []
          )
        )
      )
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <FloatingSessionPicker
        open={pickerOpen}
        onOpenChange={onPickerOpenChange}
        groups={groups}
        selectedTabId={owner?.tab.id ?? null}
        followFocus={{ following: !pinned, onSelect: () => followFocus(tabId) }}
        onPick={(candidate) => {
          if (candidate.sessionId) {
            pin(tabId, candidate.sessionId)
          }
        }}
        trailing={(candidate) => {
          const row = candidate.sessionId ? progressBySession[candidate.sessionId] : null
          return row ? `${row.checked}/${row.total}` : null
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('components.floatingChecklist.choose', 'Choose a checklist')}
          className="min-w-0 max-w-full justify-start gap-1.5"
        >
          {owner ? (
            <AgentIcon agent={agentTypeToIconAgent(owner.tab.agentSessionAgent)} size={14} />
          ) : null}
          <span className="min-w-0 truncate">
            {owner?.tab.label ?? t('components.floatingChecklist.noSession', 'No session')}
          </span>
          {progress ? (
            <span className="shrink-0 text-muted-foreground">
              {progress.checked}/{progress.total}
            </span>
          ) : null}
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </FloatingSessionPicker>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        {pinned ? <Pin aria-hidden className="size-3" /> : null}
        {pinned
          ? t('components.floatingChecklist.pinned', 'Pinned')
          : t('components.floatingChecklist.followingFocus', 'Following focus')}
      </span>
    </div>
  )
}

type HeaderProps = Omit<Parameters<typeof ChecklistHeader>[0], 'progress' | 'owner'>

function SessionChecklistView({
  sessionId,
  owner,
  header
}: {
  sessionId: string
  owner: SessionOwner
  header: HeaderProps
}): React.JSX.Element {
  const journalItems = useSessionJournalItems(sessionId)
  const state = useNativeChatChecklist({
    target: owner.target,
    sessionId,
    journalItems,
    polling: true
  })
  const total = state.checklist?.items.length ?? 0
  return (
    <>
      <ChecklistHeader
        {...header}
        owner={owner}
        progress={total > 0 ? { checked: state.checklist?.checked ?? 0, total } : null}
      />
      <div className="space-y-2 px-3 pb-3">
        <NativeChatChecklistBody
          target={owner.target}
          sessionId={sessionId}
          agentLabel={formatAgentRowTypeLabel({ agentType: owner.tab.agentSessionAgent })}
          worktreeId={owner.tab.worktreeId}
          state={state}
        />
      </div>
    </>
  )
}

/** The floating workspace's Checklist tab: one chat's checklist, following focus or held on a pick. */
export function FloatingChecklistPane({ tabId }: { tabId: string }): React.JSX.Element {
  const { t } = useTranslation()
  const { sessionId, pinned, progressBySession, requestProgress } =
    useFloatingChecklistSession(tabId)
  // Read each render: a chat tab opened or closed elsewhere changes who owns the session.
  const owner = sessionId ? checklistTargetForSession(sessionId) : null
  const header: HeaderProps = { tabId, pinned, progressBySession, requestProgress }
  return (
    <div className="absolute inset-0 scrollbar-sleek flex min-h-0 flex-col overflow-y-auto bg-background text-sm">
      {sessionId && owner ? (
        <SessionChecklistView key={sessionId} sessionId={sessionId} owner={owner} header={header} />
      ) : (
        <>
          <ChecklistHeader {...header} owner={null} progress={null} />
          <p className="px-3 text-muted-foreground">
            {t(
              'components.nativeChatSummary.checklistEmpty',
              'No checklist yet. Ask the agent for one, or add your own items.'
            )}
          </p>
        </>
      )}
    </div>
  )
}
