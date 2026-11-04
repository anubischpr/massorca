import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeWorktreeAgentRow } from '../../../src/shared/runtime-types'
import { WorktreeAgentRow } from './WorktreeAgentRow'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ GitBranch: 'GitBranch' }))
vi.mock('./SessionStatusMark', () => ({ SessionStatusMark: () => null }))
vi.mock('./MobileAgentIcon', () => ({ MobileAgentIcon: () => null }))
vi.mock('../bot-teams/MobileBotTeamSessionCharacter', () => ({
  MobileBotTeamSessionCharacter: ({ sessionTeam }: { sessionTeam: unknown }) =>
    sessionTeam ? 'TEAM-CHARACTER' : null
}))

const TEAM = { teamId: 'team-a', teamName: 'Team A', character: 'square' as const }

function agent(): RuntimeWorktreeAgentRow {
  return {
    paneKey: 'structured-agent-session-claude_1:leaf',
    parentPaneKey: null,
    state: 'done',
    agentType: 'claude',
    prompt: 'Show usage by day',
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

describe('WorktreeAgentRow bot-team character', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function render(botTeam: typeof TEAM | undefined): string {
    act(() => {
      renderer = create(
        createElement(WorktreeAgentRow, {
          agent: agent(),
          depth: 0,
          now: 2_000,
          glyph: null,
          botTeam
        } as never)
      )
    })
    return JSON.stringify(renderer?.toJSON())
  }

  it('shows the team character on the name line, after the session name', () => {
    const serialized = render(TEAM)
    expect(serialized.indexOf('Show usage by day')).toBeGreaterThanOrEqual(0)
    expect(serialized.indexOf('Show usage by day')).toBeLessThan(
      serialized.indexOf('TEAM-CHARACTER')
    )
    expect(renderer?.root.findAllByType('Pressable')).toHaveLength(1)
  })

  it('shows no character for a session no team started', () => {
    expect(render(undefined)).not.toContain('TEAM-CHARACTER')
  })
})
