import { describe, expect, it } from 'vitest'
import type { AiVaultSession } from '../../../src/shared/ai-vault-types'
import {
  delegatedChildStatusLabel,
  DELEGATED_CHILD_BADGE_LABEL
} from './agent-history-session-card'
import { buildMobileAgentHistorySections, readDelegatedFrom } from './agent-history-sections'

const NOW = Date.parse('2026-10-29T12:00:00.000Z')

function session(id: string, overrides: Partial<AiVaultSession> = {}): AiVaultSession {
  return {
    id,
    executionHostId: 'local',
    agent: 'claude',
    sessionId: id,
    title: `Title ${id}`,
    cwd: '/Users/ada/repo/app',
    branch: null,
    model: null,
    filePath: `/sessions/${id}.jsonl`,
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-10-29T11:55:00.000Z',
    modifiedAt: '2026-10-29T11:55:00.000Z',
    messageCount: 3,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    structuredSession: { sessionId: `chat-${id}`, workspaceId: 'ws' },
    ...overrides
  }
}

function childOf(id: string, parentId: string, overrides: Partial<AiVaultSession> = {}) {
  return session(id, {
    delegatedFrom: { parentSessionId: `chat-${parentId}`, status: 'working' },
    ...overrides
  })
}

function options(showAutomatedRuns = false) {
  return {
    query: '',
    scope: 'all' as const,
    scopeFilterPaths: [],
    activeWorktreePath: null,
    now: NOW,
    showAutomatedRuns
  }
}

describe('mobile agent history delegated children', () => {
  it('nests a child under its shown parent card with its status', () => {
    const sections = buildMobileAgentHistorySections(
      [session('parent'), childOf('kid', 'parent')],
      options()
    )

    const rows = sections.flatMap((section) => section.data)
    expect(rows.map((row) => row.id)).toEqual(['parent'])
    expect(rows[0]?.nestedChildren?.map((child) => child.id)).toEqual(['kid'])
    expect(rows[0]?.nestedChildren?.[0]?.delegatedChild).toEqual({ status: 'working' })
    expect(rows[0]?.delegatedChild).toBeUndefined()
  })

  it('shows a child as a normal top-level card when its parent is hidden by the switch', () => {
    const sections = buildMobileAgentHistorySections(
      [
        session('parent', { title: 'You are a code reviewer. Review the diff.' }),
        childOf('kid', 'parent')
      ],
      options(false)
    )

    const rows = sections.flatMap((section) => section.data)
    expect(rows.map((row) => row.id)).toEqual(['kid'])
    expect(rows[0]?.delegatedChild).toBeUndefined()
    expect(rows[0]?.nestedChildren).toBeUndefined()
  })

  it('keeps an automated-run child nested under a visible parent with the switch off', () => {
    const sections = buildMobileAgentHistorySections(
      [
        session('parent'),
        childOf('kid', 'parent', { title: 'You are the sdd-apply subagent. Implement.' })
      ],
      options(false)
    )

    const rows = sections.flatMap((section) => section.data)
    expect(rows.map((row) => row.id)).toEqual(['parent'])
    expect(rows[0]?.nestedChildren?.map((child) => child.id)).toEqual(['kid'])
  })

  it('reads a link with an unknown status or shape as no link', () => {
    expect(
      readDelegatedFrom({ parentSessionId: 'chat-parent', status: 'paused-by-a-newer-host' })
    ).toBeUndefined()
    expect(readDelegatedFrom({ parentSessionId: '', status: 'working' })).toBeUndefined()
    expect(readDelegatedFrom(null)).toBeUndefined()
    expect(readDelegatedFrom({ parentSessionId: 'chat-parent', status: 'working' })).toEqual({
      parentSessionId: 'chat-parent',
      status: 'working'
    })
  })

  it('names the child badge and the status words a nested row shows', () => {
    expect(DELEGATED_CHILD_BADGE_LABEL).toBe('Child session')
    expect(delegatedChildStatusLabel('working')).toBe('working')
    expect(delegatedChildStatusLabel('succeeded')).toBe('finished')
    expect(delegatedChildStatusLabel('failed')).toBe('failed')
    expect(delegatedChildStatusLabel('not-started')).toBeNull()
  })
})
