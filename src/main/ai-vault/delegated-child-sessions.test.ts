import { describe, expect, it, vi } from 'vitest'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import type { DelegatedChildLinkRow } from '../runtime/orchestration/db/delegation/delegation-request-store'
import {
  delegatedChildStatus,
  projectDelegatedChildAiVaultSessions
} from './delegated-child-sessions'

function session(overrides: Partial<AiVaultSession> & { id: string }): AiVaultSession {
  return {
    executionHostId: 'local',
    agent: 'claude',
    sessionId: overrides.id,
    title: overrides.id,
    cwd: '/repo',
    branch: null,
    model: null,
    filePath: `/sessions/${overrides.id}.jsonl`,
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-10-29T10:00:00.000Z',
    modifiedAt: '2026-10-29T10:00:00.000Z',
    messageCount: 2,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    structuredSession: { sessionId: `chat-${overrides.id}`, workspaceId: 'ws' },
    ...overrides
  }
}

function result(sessions: AiVaultSession[]): AiVaultListResult {
  return { sessions, issues: [], scannedAt: '2026-10-29T10:00:00.000Z' }
}

function link(
  overrides: Partial<DelegatedChildLinkRow> & Pick<DelegatedChildLinkRow, 'child_session_id'>
): DelegatedChildLinkRow {
  return {
    parent_session_id: 'chat-parent',
    run_id: null,
    task_id: 'task-1',
    dispatch_id: 'dispatch-1',
    dispatch_status: 'dispatched',
    task_spec: null,
    task_title: null,
    display_name: null,
    ...overrides
  }
}

describe('projectDelegatedChildAiVaultSessions', () => {
  it('attaches the parent and a working status to a child of a listed parent', () => {
    const parent = session({ id: 'parent' })
    const kid = session({ id: 'kid' })
    const db = { listDelegatedChildLinks: vi.fn(() => [link({ child_session_id: 'chat-kid' })]) }

    const projected = projectDelegatedChildAiVaultSessions(result([parent, kid]), () => db)

    expect(projected.sessions[1]?.delegatedFrom).toEqual({
      parentSessionId: 'chat-parent',
      status: 'working'
    })
    expect(projected.sessions[0]?.delegatedFrom).toBeUndefined()
  })

  it('queries only the local structured session ids of the list', () => {
    const remote = session({
      id: 'remote',
      executionHostId: 'ssh:devbox',
      structuredSession: { sessionId: 'chat-remote', workspaceId: 'ws' }
    })
    const local = session({ id: 'local' })
    const db = { listDelegatedChildLinks: vi.fn(() => []) }

    projectDelegatedChildAiVaultSessions(result([remote, local]), () => db)

    expect(db.listDelegatedChildLinks).toHaveBeenCalledWith(['chat-local'])
  })

  it('leaves a remote row alone even when its id matches a link', () => {
    const remote = session({
      id: 'remote',
      executionHostId: 'ssh:devbox',
      structuredSession: { sessionId: 'chat-kid', workspaceId: 'ws' }
    })
    const db = { listDelegatedChildLinks: vi.fn(() => [link({ child_session_id: 'chat-kid' })]) }

    const input = result([remote])
    const projected = projectDelegatedChildAiVaultSessions(input, () => db)

    expect(projected).toBe(input)
  })

  it('returns the same result when there is no orchestration database', () => {
    const input = result([session({ id: 'kid' })])

    expect(projectDelegatedChildAiVaultSessions(input, () => null)).toBe(input)
  })

  it('returns the same result when no row is a child', () => {
    const input = result([session({ id: 'kid' })])
    const db = { listDelegatedChildLinks: vi.fn(() => []) }

    expect(projectDelegatedChildAiVaultSessions(input, () => db)).toBe(input)
  })

  it('leaves the children top-level when the link read throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const input = result([session({ id: 'kid' })])
    const db = {
      listDelegatedChildLinks: () => {
        throw new Error('database is closed')
      }
    }

    expect(projectDelegatedChildAiVaultSessions(input, () => db)).toBe(input)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('delegatedChildStatus', () => {
  it.each([
    ['dispatched', 'working'],
    ['completed', 'succeeded'],
    ['failed', 'failed'],
    ['circuit_broken', 'failed'],
    ['pending', 'not-started'],
    [null, 'not-started']
  ] as const)('maps dispatch %s to %s', (dispatchStatus, expected) => {
    expect(delegatedChildStatus(dispatchStatus)).toBe(expected)
  })
})
