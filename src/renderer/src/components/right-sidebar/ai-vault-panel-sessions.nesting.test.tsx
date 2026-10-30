// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import { useAiVaultPanelSessions } from './ai-vault-session-filters'

const base: AiVaultSession = {
  id: 'p',
  executionHostId: 'local',
  agent: 'claude',
  sessionId: 'prov-p',
  title: 'Parent',
  cwd: '/work/repo',
  branch: null,
  model: null,
  filePath: '/x/p.jsonl',
  codexHome: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:10:00.000Z',
  modifiedAt: '2026-05-01T10:10:00.000Z',
  messageCount: 4,
  totalTokens: 1,
  previewMessages: [],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: '',
  subagent: null
}

const parent: AiVaultSession = {
  ...base,
  structuredSession: { sessionId: 'S-P', workspaceId: 'w' }
}
const child: AiVaultSession = {
  ...base,
  id: 'c',
  sessionId: 'prov-c',
  title: 'Child',
  structuredSession: { sessionId: 'S-C', workspaceId: 'w' },
  delegatedFrom: { parentSessionId: 'S-P', status: 'working' }
}

function run(sessions: AiVaultSession[], over: Record<string, unknown> = {}) {
  return renderHook(() =>
    useAiVaultPanelSessions(sessions, false, 'folder', {
      query: '',
      agents: ['claude'],
      scope: 'workspace',
      sort: 'updated',
      activeWorktreePaths: ['/work/repo'],
      excludedWorktreePaths: [],
      activeProjectKey: null,
      sessionProjectById: new Map(),
      projectLabelByKey: new Map(),
      hideEmptySessions: true,
      showAutomatedRuns: false,
      ...over
    })
  ).result.current
}

describe('useAiVaultPanelSessions nesting', () => {
  it('nests a delegated child under its parent', () => {
    const out = run([child, parent])
    expect(out.groups.flatMap((g) => g.sessions.map((s) => s.id))).toEqual(['p'])
    expect(out.delegatedChildrenByRootId.get('p')?.map((s) => s.id)).toEqual(['c'])
  })
})
