// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiVaultScope } from '../../../../shared/ai-vault-types'
import { VaultScopeSwitch } from './AiVaultPanelControls'

afterEach(cleanup)

function renderScopeSwitch(scope: AiVaultScope, workspaceIsFolder = false) {
  return render(
    <VaultScopeSwitch
      scope={scope}
      workspaceAvailable
      workspaceIsFolder={workspaceIsFolder}
      projectAvailable
      onScopeChange={vi.fn()}
    />
  )
}

describe('VaultScopeSwitch scope labels', () => {
  it('names the workspace scope This worktree for a git worktree', () => {
    renderScopeSwitch('workspace')

    expect(screen.getByText('This worktree')).toBeInTheDocument()
    expect(screen.queryByText('Workspace')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Session History scope: current worktree')).toBeInTheDocument()
  })

  it('names the workspace scope This folder for a folder workspace', () => {
    renderScopeSwitch('workspace', true)

    expect(screen.getByText('This folder')).toBeInTheDocument()
    expect(screen.queryByText('This worktree')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Session History scope: current folder')).toBeInTheDocument()
  })

  it('keeps Project and All unchanged for a folder workspace', () => {
    renderScopeSwitch('all', true)

    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })
})
