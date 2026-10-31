import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../src/shared/structured-agent-session-projection'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { WorktreeAgentList } from './WorktreeAgentList'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('./WorktreeAgentRow', () => ({
  SESSION_INDENT: 36,
  WorktreeAgentRow: 'WorktreeAgentRow'
}))

function agent(
  paneKey: string,
  parentPaneKey: string | null = null,
  overrides: Partial<RuntimeWorktreeAgentRow> = {}
): RuntimeWorktreeAgentRow {
  return {
    paneKey,
    parentPaneKey,
    state: 'done',
    agentType: 'codex',
    prompt: `Prompt ${paneKey}`,
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1_000,
    updatedAt: 1_000,
    ...overrides
  }
}

function quietAgents(count: number): RuntimeWorktreeAgentRow[] {
  return Array.from({ length: count }, (_, index) => agent(`agent-${index + 1}`))
}

function renderList(
  agents: RuntimeWorktreeAgentRow[],
  disconnected = false
): Promise<ReactTestRenderer> {
  return act(async () => {
    renderer = create(
      createElement(WorktreeAgentList, {
        agents,
        now: 2_000,
        unvisited: false,
        disconnected
      })
    )
  }).then(() => renderer!)
}

let renderer: ReactTestRenderer | null = null

function buttonLabel(): string | undefined {
  const text = renderer!.root.findAllByType('Text' as never).map((node) => node.props.children)
  return text.find((value) => typeof value === 'string' && value.startsWith('Show'))
}

describe('WorktreeAgentList', () => {
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  it('shows five sessions, then folds the rest behind "Show N more"', async () => {
    await renderList(quietAgents(7))

    expect(renderer!.root.findAllByType('WorktreeAgentRow' as never)).toHaveLength(5)
    expect(buttonLabel()).toBe('Show 2 more')

    await act(async () => renderer!.root.findByType('Pressable' as never).props.onPress())

    expect(renderer!.root.findAllByType('WorktreeAgentRow' as never)).toHaveLength(7)
    expect(buttonLabel()).toBe('Show less')
  })

  it('keeps a session that needs a person in view past the limit', async () => {
    const agents = [
      ...quietAgents(6),
      agent('waiting-agent', null, { state: 'waiting', updatedAt: 2_000 })
    ]
    await renderList(agents)

    const rows = renderer!.root.findAllByType('WorktreeAgentRow' as never)
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.props.agent.paneKey)).toContain('waiting-agent')
    expect(buttonLabel()).toBe('Show 2 more')
  })

  it('shows no fold control for four sessions', async () => {
    await renderList(quietAgents(4))

    expect(renderer!.root.findAllByType('Pressable' as never)).toHaveLength(0)
    expect(renderer!.root.findAllByType('WorktreeAgentRow' as never)).toHaveLength(4)
  })

  it('reads every session as unconfirmed on an unreachable host', async () => {
    await renderList([agent('waiting-agent', null, { state: 'waiting', updatedAt: 2_000 })], true)

    const [row] = renderer!.root.findAllByType('WorktreeAgentRow' as never)
    expect(row!.props.glyph).toBe('unconfirmed')
  })

  it('nests a delegated child under its structured parent, one level in', async () => {
    // Why: the rows carry the runtime's own structured pane keys, the ones a delegated child's parent link names.
    const parentKey = structuredAgentSessionPaneKey(
      structuredAgentSessionTabId('parent-session'),
      'parent-session'
    )
    const childKey = structuredAgentSessionPaneKey(
      structuredAgentSessionTabId('child-session'),
      'child-session'
    )
    await renderList([agent(childKey, parentKey), agent(parentKey)])
    // A single root draws its tree straight away, with no summary to expand.
    const rows = renderer!.root.findAll((node) => 'depth' in node.props)
    expect(rows.map((row) => row.props.agent.paneKey)).toEqual([parentKey, childKey])
    expect(rows.map((row) => row.props.depth)).toEqual([0, 1])
  })
})
