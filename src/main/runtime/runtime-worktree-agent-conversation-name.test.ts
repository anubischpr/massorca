import { describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../shared/stable-pane-id'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../shared/structured-agent-session-projection'
import {
  resolveRowConversationName,
  type RowConversationNameLookups
} from './runtime-worktree-agent-conversation-name'

const WORKTREE_ID = 'repo-1::/workspace/app'
const SESSION = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const CHAT_TAB_ID = structuredAgentSessionTabId(SESSION)
const CHAT_KEY = structuredAgentSessionPaneKey(CHAT_TAB_ID, SESSION)
const TAB_KEY = makePaneKey('tab-1', '11111111-1111-4111-8111-111111111111')
const SIBLING_KEY = makePaneKey('tab-1', '22222222-2222-4222-8222-222222222222')
const OTHER_TAB_KEY = makePaneKey('tab-2', '11111111-1111-4111-8111-111111111111')

const chatRow = { paneKey: CHAT_KEY, worktreeId: WORKTREE_ID, parentPaneKey: null }

function lookups(overrides: Partial<RowConversationNameLookups> = {}): RowConversationNameLookups {
  return { chatTab: () => null, chatSavedName: () => null, terminalName: () => null, ...overrides }
}

describe('resolveRowConversationName', () => {
  it("names a chat row by its open tab's label", () => {
    const chatTab = () => ({ customLabel: null, label: 'Refactor auth' })
    expect(resolveRowConversationName(chatRow, lookups({ chatTab }))).toBe('Refactor auth')
  })

  it("prefers the chat's custom label, then its saved name, over the tab label", () => {
    const chatSavedName = () => 'Saved name'
    expect(
      resolveRowConversationName(
        chatRow,
        lookups({
          chatTab: () => ({ customLabel: 'My name', label: 'Refactor auth' }),
          chatSavedName
        })
      )
    ).toBe('My name')
    expect(
      resolveRowConversationName(
        chatRow,
        lookups({
          chatTab: () => ({ customLabel: null, label: 'Refactor auth' }),
          chatSavedName
        })
      )
    ).toBe('Saved name')
  })

  it('looks the chat tab up by the worktree and session the row runs in', () => {
    const chatTab = vi.fn(() => ({ customLabel: null, label: 'Refactor auth' }))
    resolveRowConversationName(chatRow, lookups({ chatTab }))
    expect(chatTab).toHaveBeenCalledWith(WORKTREE_ID, SESSION)
  })

  it('names no chat row whose chat has no open tab', () => {
    expect(
      resolveRowConversationName(chatRow, lookups({ chatSavedName: () => 'Saved name' }))
    ).toBeNull()
  })

  it('names a terminal row through its live terminal handle', () => {
    const terminalName = vi.fn(() => 'Build watcher')
    const row = {
      paneKey: TAB_KEY,
      worktreeId: WORKTREE_ID,
      terminalHandle: 'term_1',
      parentPaneKey: null
    }
    expect(resolveRowConversationName(row, lookups({ terminalName }))).toBe('Build watcher')
    expect(terminalName).toHaveBeenCalledWith('term_1')
  })

  it('names no terminal row without a live terminal handle', () => {
    const terminalName = vi.fn(() => 'Build watcher')
    const row = { paneKey: TAB_KEY, worktreeId: WORKTREE_ID, parentPaneKey: null }
    expect(resolveRowConversationName(row, lookups({ terminalName }))).toBeNull()
    expect(terminalName).not.toHaveBeenCalled()
  })

  it("names no row that shares its parent's tab, since that tab's name belongs to the parent", () => {
    const child = {
      paneKey: SIBLING_KEY,
      worktreeId: WORKTREE_ID,
      terminalHandle: 'term_2',
      parentPaneKey: TAB_KEY
    }
    expect(
      resolveRowConversationName(child, lookups({ terminalName: () => 'Parent tab name' }))
    ).toBeNull()
    const chatChild = {
      ...chatRow,
      parentPaneKey: makePaneKey(CHAT_TAB_ID, '22222222-2222-4222-8222-222222222222')
    }
    expect(
      resolveRowConversationName(
        chatChild,
        lookups({ chatTab: () => ({ customLabel: null, label: 'Refactor auth' }) })
      )
    ).toBeNull()
  })

  it('names a row whose parent runs in another tab', () => {
    const child = {
      paneKey: SIBLING_KEY,
      worktreeId: WORKTREE_ID,
      terminalHandle: 'term_2',
      parentPaneKey: OTHER_TAB_KEY
    }
    expect(resolveRowConversationName(child, lookups({ terminalName: () => 'Own tab name' }))).toBe(
      'Own tab name'
    )
  })
})
