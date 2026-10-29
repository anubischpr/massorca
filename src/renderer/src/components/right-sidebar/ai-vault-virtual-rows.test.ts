import { describe, expect, it } from 'vitest'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import type { AiVaultSessionListGroup } from './ai-vault-session-filters'
import { buildAiVaultVirtualRows } from './ai-vault-virtual-rows'

function session(id: string): AiVaultSession {
  return {
    id,
    executionHostId: 'local',
    agent: 'claude',
    sessionId: id,
    title: id,
    cwd: '/repo',
    branch: null,
    model: null,
    filePath: `/sessions/${id}.jsonl`,
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-10-29T10:00:00.000Z',
    modifiedAt: '2026-10-29T10:00:00.000Z',
    messageCount: 1,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null
  }
}

function rowIds(rows: ReturnType<typeof buildAiVaultVirtualRows>): string[] {
  return rows.map((row) => {
    if (row.type === 'group') {
      return `group:${row.group.key}`
    }
    return `${row.nestedChild ? 'child' : 'session'}:${row.session.id}`
  })
}

describe('buildAiVaultVirtualRows', () => {
  const parent = session('parent')
  const kid = session('kid')
  const other = session('other')
  const groups: AiVaultSessionListGroup[] = [
    { key: 'g1', label: 'Claude', sessions: [parent, other] },
    { key: 'g2', label: 'Codex', sessions: [] }
  ]

  it('places each delegated child right after its parent row, flagged as nested', () => {
    const rows = buildAiVaultVirtualRows({
      groups,
      collapsedGroups: new Set(),
      delegatedChildrenByRootId: new Map([['parent', [kid]]])
    })

    expect(rowIds(rows)).toEqual([
      'group:g1',
      'session:parent',
      'child:kid',
      'session:other',
      'group:g2'
    ])
  })

  it('hides a collapsed group with its parents and their children', () => {
    const rows = buildAiVaultVirtualRows({
      groups,
      collapsedGroups: new Set(['g1']),
      delegatedChildrenByRootId: new Map([['parent', [kid]]])
    })

    expect(rowIds(rows)).toEqual(['group:g1', 'group:g2'])
  })

  it('lists no children when no parent in the groups has one', () => {
    const rows = buildAiVaultVirtualRows({
      groups,
      collapsedGroups: new Set(),
      delegatedChildrenByRootId: new Map()
    })

    expect(rows.every((row) => row.type === 'group' || row.nestedChild === undefined)).toBe(true)
    expect(rowIds(rows)).toEqual(['group:g1', 'session:parent', 'session:other', 'group:g2'])
  })
})
