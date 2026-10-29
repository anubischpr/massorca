// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AiVaultDelegatedFrom, AiVaultSession } from '../../../../shared/ai-vault-types'
import { SessionMetadata } from './ai-vault-session-row-display'

afterEach(cleanup)

function session(overrides: Partial<AiVaultSession>): AiVaultSession {
  return {
    id: 'codex:child',
    executionHostId: 'local',
    agent: 'codex',
    sessionId: 'child-1',
    title: 'Repro the leak with a real rollout',
    cwd: '/Users/ada/repo/app',
    branch: null,
    model: 'gpt-6-luna',
    filePath: '/Users/ada/.codex/sessions/child-1.jsonl',
    codexHome: null,
    createdAt: null,
    updatedAt: '2026-10-29T10:10:00.000Z',
    modifiedAt: '2026-10-29T10:10:00.000Z',
    messageCount: 7,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 2,
    resumeCommand: '',
    subagent: null,
    ...overrides
  }
}

function renderChild(delegatedFrom: AiVaultDelegatedFrom | undefined): void {
  const value = session({ delegatedFrom })
  render(
    <SessionMetadata
      session={value}
      liveState={null}
      updatedAt={value.updatedAt ?? value.modifiedAt}
      worktreeInfo={{
        worktreeId: 'repo::/Users/ada/repo/app',
        label: 'app',
        status: 'active',
        path: '/Users/ada/repo/app'
      }}
      vaultScope="all"
      nestedChild
    />
  )
}

describe('SessionMetadata for a delegated child', () => {
  it('leads with a Child session badge, then the agent name', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'working' })

    expect(screen.getByText('Child session')).toBeInTheDocument()
    expect(screen.getByText('Codex')).toBeInTheDocument()
  })

  it('shows working with a green live dot before the word', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'working' })

    const dot = screen.getByText('working').querySelector('span')
    expect(dot).toHaveClass('size-1.5', 'rounded-full', 'bg-status-success')
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows finished for a child that succeeded, without a dot', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'succeeded' })

    const word = screen.getByText('finished')
    expect(word.querySelector('span')).toBeNull()
    expect(screen.queryByText('working')).not.toBeInTheDocument()
  })

  it('shows failed for a child whose run failed', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'failed' })

    expect(screen.getByText('failed')).toBeInTheDocument()
  })

  it('omits the status word for a delegation that has not started', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'not-started' })

    expect(screen.getByText('Child session')).toBeInTheDocument()
    expect(screen.queryByText('working')).not.toBeInTheDocument()
    expect(screen.queryByText('finished')).not.toBeInTheDocument()
    expect(screen.queryByText('failed')).not.toBeInTheDocument()
  })

  it('carries no message count, model, subagent count or worktree line', () => {
    renderChild({ parentSessionId: 'chat-parent', status: 'working' })

    expect(screen.queryByText(/msgs/)).not.toBeInTheDocument()
    expect(screen.queryByText(/subagent/)).not.toBeInTheDocument()
    expect(screen.queryByText('gpt-6-luna')).not.toBeInTheDocument()
    expect(screen.queryByText('app')).not.toBeInTheDocument()
  })

  it('shows no Child session badge on a top-level row, even one with a parent link', () => {
    const value = session({ delegatedFrom: { parentSessionId: 'chat-parent', status: 'working' } })
    render(
      <SessionMetadata
        session={value}
        liveState={null}
        updatedAt={value.updatedAt ?? value.modifiedAt}
        worktreeInfo={null}
        vaultScope="all"
      />
    )

    expect(screen.queryByText('Child session')).not.toBeInTheDocument()
    expect(screen.getByText('7 msgs')).toBeInTheDocument()
  })
})
