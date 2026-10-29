// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AiVaultSession } from '../../../../shared/ai-vault-types'
import { SessionMetadata } from './ai-vault-session-row-display'

afterEach(cleanup)

function session(overrides: Partial<AiVaultSession>): AiVaultSession {
  return {
    id: 'claude:1',
    executionHostId: 'local',
    agent: 'claude',
    sessionId: 'session-1',
    title: 'Implement vault filters',
    cwd: '/Users/ada/repo/app',
    branch: null,
    model: null,
    filePath: '/Users/ada/.claude/projects/session-1.jsonl',
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-05-01T10:10:00.000Z',
    modifiedAt: '2026-05-01T10:10:00.000Z',
    messageCount: 2,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: '',
    subagent: null,
    ...overrides
  }
}

function renderMetadata(value: AiVaultSession): void {
  render(
    <SessionMetadata
      session={value}
      liveState={null}
      updatedAt={value.updatedAt ?? value.modifiedAt}
      worktreeInfo={null}
      vaultScope="all"
    />
  )
}

describe('SessionMetadata automated-run badge', () => {
  it('leads a code review run with a Review badge', () => {
    renderMetadata(session({ title: 'You are a code reviewer. Review the diff.' }))

    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.queryByText('SDD')).not.toBeInTheDocument()
  })

  it('names an SDD worker run SDD', () => {
    renderMetadata(session({ title: 'You are the sdd-apply subagent. Implement the tasks.' }))

    expect(screen.getByText('SDD')).toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
  })

  it('shows no badge for an ordinary session', () => {
    renderMetadata(session({}))

    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(screen.queryByText('SDD')).not.toBeInTheDocument()
  })
})
