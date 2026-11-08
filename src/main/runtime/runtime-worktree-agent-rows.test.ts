import { describe, expect, it, vi } from 'vitest'
import type { RuntimeWorktreePsSummary } from '../../shared/runtime-types'
import { makePaneKey } from '../../shared/stable-pane-id'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import { attachRuntimeWorktreeAgentRows } from './runtime-worktree-agent-rows'
import type { RowConversationNameSource } from './runtime-worktree-agent-conversation-name'
import type { RuntimeWorktreeAgentSource } from './runtime-worktree-agent-source'
import type { RuntimeWorktreeSummaryPathIndex } from './runtime-worktree-summary-paths'

const WORKTREE_ID = 'repo-1::/workspace/app'
const SESSION = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const CHAT_KEY = structuredAgentSessionPaneKey(structuredAgentSessionTabId(SESSION), SESSION)
const PARENT_KEY = makePaneKey('tab-1', '11111111-1111-4111-8111-111111111111')

const PATH_INDEX: RuntimeWorktreeSummaryPathIndex = {
  platformByRepoId: new Map(),
  posixAbsolute: new Map(),
  posixRelative: new Map(),
  windows: new Map(),
  windowsAbsolute: new Map()
}

function chatSource(): RuntimeWorktreeAgentSource {
  return {
    paneKey: CHAT_KEY,
    worktreeId: WORKTREE_ID,
    connectionId: null,
    state: 'working',
    agentType: 'claude',
    prompt: 'ship the thing',
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 100,
    updatedAt: Date.now()
  }
}

function attach(
  conversationNameForRow?: (row: RowConversationNameSource) => string | null,
  orchestrationByPaneKey: Record<string, { parentPaneKey?: string | null }> | null = null
): RuntimeWorktreePsSummary {
  const summary = { worktreeId: WORKTREE_ID, agents: [] } as unknown as RuntimeWorktreePsSummary
  attachRuntimeWorktreeAgentRows({
    summaries: new Map([[WORKTREE_ID, summary]]),
    pathIndex: PATH_INDEX,
    missingWorktreeIds: new Set(),
    rowSources: new Map([[CHAT_KEY, chatSource()]]),
    workingTerminalEvidenceByWorktreeId: new Map(),
    orchestrationByPaneKey,
    getSummary: (map, _pathIndex, _missing, id) => map.get(id) ?? null,
    conversationNameForRow
  })
  return summary
}

describe('attachRuntimeWorktreeAgentRows conversation names', () => {
  it('carries the conversation name the resolver gives a row', () => {
    const [row] = attach(() => 'Refactor auth').agents
    expect(row).toMatchObject({ paneKey: CHAT_KEY, conversationName: 'Refactor auth' })
  })

  it('hands the resolver each row with its worktree and parent pane', () => {
    const resolver = vi.fn((): string | null => null)
    attach(resolver, { [CHAT_KEY]: { parentPaneKey: PARENT_KEY } })
    expect(resolver).toHaveBeenCalledWith({
      paneKey: CHAT_KEY,
      worktreeId: WORKTREE_ID,
      parentPaneKey: PARENT_KEY
    })
  })

  it('leaves conversationName off a row the resolver names nothing', () => {
    const [row] = attach(() => null).agents
    expect(row).not.toHaveProperty('conversationName')
  })
})
