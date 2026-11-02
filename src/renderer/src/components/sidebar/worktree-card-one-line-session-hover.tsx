import React, { useMemo, useRef } from 'react'

import { NativeChatInteractiveCard } from '@/components/native-chat/NativeChatInteractiveCard'
import {
  parseInteractivePrompt,
  type InteractivePromptCard
} from '@/components/native-chat/native-chat-interactive-prompt'
import { useNativeChatInteractiveSend } from '@/components/native-chat/use-native-chat-interactive-send'
import type { AgentStatusEntry } from '../../../../shared/agent-status-types'
import type { AgentType } from '../../../../shared/native-chat-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { parsePaneKey } from '../../../../shared/stable-pane-id'
import { getHostContextLabel } from '../../../../shared/worktree/host-context-labels'
import { useAppStore } from '@/store'
import { findWorktreeById } from '@/store/github/worktree-refresh'
import { selectRuntimeAwareSshTargetLabel } from '@/store/slices/runtime-environment-ssh-selectors'
import {
  structuredAgentSessionOwnerForTab,
  structuredAgentSessionTargetForHost
} from '@/runtime/structured-agent-session-owner'
import { isStructuredTab } from '@/components/native-chat/structured-agent-session-tabs'
import { WorktreeCardDetailsHover } from './WorktreeCardMeta'
import {
  useWorktreeCardDetailsHoverControl,
  type WorktreeCardDetailsHoverControl
} from './worktree-card-details-hover-state'
import type { SessionStatusGlyph } from './worktree-session-status'

// Why lazy: the Environment section pulls in the chat pieces, which only a hovered session ever needs.
const WorktreeCardEnvironmentSection = React.lazy(() =>
  import('./WorktreeCardEnvironmentSection').then((module) => ({
    default: module.WorktreeCardEnvironmentSection
  }))
)

const OneLineStructuredSessionPrompt = React.lazy(
  () => import('./worktree-card-one-line-structured-session-prompt')
)

/**
 * The PTY a session pane writes to, read from the store so a tab that is not mounted still answers.
 * Null when the pane has no live PTY: a stale layout id never receives an answer.
 */
export function livePtyIdForSessionPane(
  paneKey: string,
  layoutPtyIdsByLeafId: Readonly<Record<string, string>> | undefined,
  livePtyIds: readonly string[] | undefined
): string | null {
  const leafId = parsePaneKey(paneKey)?.leafId
  const ptyId = leafId ? layoutPtyIdsByLeafId?.[leafId] : undefined
  return ptyId && (livePtyIds ?? []).includes(ptyId) ? ptyId : null
}

/**
 * The structured prompt a needs-human session can be answered with on hover. Hook status without a
 * structured prompt, a dimmed (unreachable) host, or a session not waiting on the user shows nothing.
 */
export function sessionHoverPrompt(input: {
  ownGlyph: SessionStatusGlyph | null
  dimmed: boolean
  ptyId: string | null
  entry: Pick<AgentStatusEntry, 'interactivePrompt' | 'toolName' | 'agentType'> | undefined
}): { card: NonNullable<InteractivePromptCard>; agentType: AgentType } | null {
  const { ownGlyph, dimmed, ptyId, entry } = input
  if (ownGlyph !== 'needs-human' || dimmed || !ptyId || !entry?.agentType) {
    return null
  }
  const card = parseInteractivePrompt(
    entry.interactivePrompt,
    entry.toolName ?? undefined,
    entry.agentType
  )
  return card ? { card, agentType: entry.agentType } : null
}

type OneLineSessionHoverProps = {
  paneKey: string
  tabId: string
  worktreeId: string
  ownGlyph: SessionStatusGlyph | null
  dimmed: boolean
  /** Off while the row is renamed or is a send-target picker: the row shows no hover card. */
  enabled: boolean
  /** The branch a child session in another worktree runs on. */
  crossWorktreeBranch?: string
  children: React.ReactElement
}

/**
 * A session row's hover card. A needs-human session with a structured prompt shows that prompt to
 * answer; any other session shows the Environment facts of the worktree it runs in.
 */
export function OneLineSessionHover({
  paneKey,
  tabId,
  worktreeId,
  ownGlyph,
  dimmed,
  enabled,
  crossWorktreeBranch,
  children
}: OneLineSessionHoverProps): React.JSX.Element {
  const hover = useWorktreeCardDetailsHoverControl()
  const contentRef = useRef<HTMLDivElement>(null)
  const ptyId = useAppStore((s) =>
    livePtyIdForSessionPane(
      paneKey,
      s.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId,
      s.ptyIdsByTabId[tabId]
    )
  )
  const entry = useAppStore((s) => s.agentStatusByPaneKey[paneKey])
  const worktree = useAppStore((s) => (enabled ? findWorktreeById(s, worktreeId) : null))
  const repo = useAppStore((s) =>
    worktree ? s.repos.find((candidate) => candidate.id === worktree.repoId) : undefined
  )
  const sshTargetLabel = useAppStore((s) =>
    repo?.connectionId ? selectRuntimeAwareSshTargetLabel(s, null, repo.connectionId) : ''
  )
  const prompt = enabled ? sessionHoverPrompt({ ownGlyph, dimmed, ptyId, entry }) : null
  // Why: a structured session has no PTY; its prompt lives in the host's journal.
  const structuredTab = useAppStore((s) =>
    enabled && ownGlyph === 'needs-human' && !dimmed
      ? (s.unifiedTabsByWorktree[worktreeId] ?? []).find((tab) => tab.id === tabId)
      : undefined
  )
  const structuredOwner = useAppStore((s) =>
    structuredTab && isStructuredTab(structuredTab)
      ? structuredAgentSessionOwnerForTab(s, structuredTab)
      : null
  )
  const structuredTarget = useMemo(
    () => structuredAgentSessionTargetForHost(structuredOwner),
    [structuredOwner]
  )

  // Why: keyboard focus inside the card keeps it open, so a choice made with the keyboard is not cut off.
  const guardedHover: WorktreeCardDetailsHoverControl = {
    ...hover,
    handleHoverOpenChange: (next: boolean) => {
      if (!next && contentRef.current?.contains(document.activeElement)) {
        return
      }
      hover.handleHoverOpenChange(next)
    }
  }

  let details: React.ReactNode = null
  if (prompt && ptyId) {
    details = (
      <div ref={contentRef} data-one-line-session-prompt="">
        <SessionPromptCard
          card={prompt.card}
          tabId={tabId}
          paneKey={paneKey}
          ptyId={ptyId}
          agentType={prompt.agentType}
          onDone={hover.closeHover}
        />
      </div>
    )
  } else if (enabled && worktree) {
    const host = repo?.connectionId
      ? sshTargetLabel || repo.displayName
      : getHostContextLabel(worktree.hostId ?? LOCAL_EXECUTION_HOST_ID)
    const environment = (
      <WorktreeCardEnvironmentSection worktree={worktree} repo={repo} host={host} />
    )
    details = (
      <div ref={contentRef}>
        <React.Suspense fallback={null}>
          {structuredTab?.entityId && structuredTarget ? (
            <OneLineStructuredSessionPrompt
              sessionId={structuredTab.entityId}
              target={structuredTarget}
              agent={structuredTab.agentSessionAgent ?? ''}
              fallback={environment}
              onDone={hover.closeHover}
            />
          ) : (
            environment
          )}
        </React.Suspense>
      </div>
    )
  }

  return (
    <WorktreeCardDetailsHover
      issue={null}
      linearIssue={null}
      jiraIssue={null}
      review={null}
      comment={null}
      hoverControl={guardedHover}
      branchName={enabled ? crossWorktreeBranch : undefined}
      detailsAfter={details}
      contentClassName={prompt || structuredTarget ? 'w-[544px] max-h-[36rem]' : undefined}
      openDelay={100}
    >
      {children}
    </WorktreeCardDetailsHover>
  )
}

// Why a separate component: the answer hook needs the prompt's agent, which exists only with the card.
function SessionPromptCard({
  card,
  tabId,
  paneKey,
  ptyId,
  agentType,
  onDone
}: {
  card: NonNullable<InteractivePromptCard>
  tabId: string
  paneKey: string
  ptyId: string
  agentType: AgentType
  onDone: () => void
}): React.JSX.Element {
  const send = useNativeChatInteractiveSend(tabId, paneKey, ptyId, agentType)
  return (
    <div className="min-w-0">
      <NativeChatInteractiveCard card={card} send={send} onDismiss={onDone} />
    </div>
  )
}
