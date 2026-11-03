import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import {
  setMobileBotTeamSessionTeams,
  setMobileBotTeamShown
} from '../bot-teams/mobile-bot-team-session-team-visibility'
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

const TEAM = { teamId: 'team-a', teamName: 'Team A', character: 'square' as const }

function agent(sessionId: string): RuntimeWorktreeAgentRow {
  return {
    paneKey: `structured-agent-session-${sessionId}:leaf`,
    parentPaneKey: null,
    state: 'done',
    agentType: 'claude',
    prompt: sessionId,
    taskTitle: null,
    displayName: null,
    lastAssistantMessage: null,
    toolName: null,
    toolInput: null,
    interrupted: false,
    stateStartedAt: 1_000,
    updatedAt: 1_000
  }
}

describe('WorktreeAgentList bot-team sessions', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    setMobileBotTeamShown(false)
    setMobileBotTeamSessionTeams({})
  })

  function renderRows(): { paneKeys: string[]; botTeams: unknown[] } {
    act(() => {
      renderer = create(
        createElement(WorktreeAgentList, {
          agents: [agent('claude_1'), agent('claude_2')],
          now: 2_000,
          unvisited: false,
          disconnected: false
        })
      )
    })
    const rows = renderer?.root.findAllByType('WorktreeAgentRow') ?? []
    return {
      paneKeys: rows.map((row) => (row.props.agent as RuntimeWorktreeAgentRow).paneKey),
      botTeams: rows.map((row) => row.props.botTeam)
    }
  }

  it('hides a bot-team session row while Show bot teams is off', () => {
    setMobileBotTeamSessionTeams({ claude_1: TEAM })
    expect(renderRows().paneKeys).toEqual(['structured-agent-session-claude_2:leaf'])
  })

  it('shows every session row with its team while Show bot teams is on', () => {
    setMobileBotTeamSessionTeams({ claude_1: TEAM })
    setMobileBotTeamShown(true)
    const { paneKeys, botTeams } = renderRows()
    expect(paneKeys).toHaveLength(2)
    expect(botTeams).toEqual([TEAM, undefined])
  })
})
