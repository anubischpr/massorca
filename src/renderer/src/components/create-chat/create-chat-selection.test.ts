import { describe, expect, it } from 'vitest'
import {
  buildDefaultCreateChatSelection,
  canSubmitCreateChat,
  canUseProjectless,
  chooseCreateChatLocation,
  withAvailableCreateChatAgent,
  type CreateChatOptions,
  type CreateChatRepoOption,
  type CreateChatSelection
} from './create-chat-selection'

const localRepo: CreateChatRepoOption = {
  repoId: 'repo-local',
  displayName: 'massorca',
  path: 'D:/projects/massorca',
  hostId: 'local',
  isFolder: false
}
const sshRepo: CreateChatRepoOption = {
  repoId: 'repo-ssh',
  displayName: 'remote-app',
  path: '/srv/app',
  hostId: 'ssh:devbox',
  isFolder: false
}

function optionsWith(overrides: Partial<CreateChatOptions> = {}): CreateChatOptions {
  return {
    hosts: [],
    repos: [localRepo, sshRepo],
    preferredAgent: null,
    projectlessDirectory: 'C:/Users/me/orca/chats',
    ...overrides
  }
}

function selectionWith(overrides: Partial<CreateChatSelection> = {}): CreateChatSelection {
  return { ...buildDefaultCreateChatSelection(optionsWith()), ...overrides }
}

describe('buildDefaultCreateChatSelection', () => {
  it('starts on this computer with the first local repo and a new worktree', () => {
    expect(buildDefaultCreateChatSelection(optionsWith())).toEqual({
      executionHostId: 'local',
      project: { kind: 'repo', repoId: 'repo-local' },
      workspaceMode: 'new-worktree',
      agent: 'claude',
      accessMode: 'default'
    })
  })

  it('falls back to a projectless chat when no local repo exists', () => {
    const selection = buildDefaultCreateChatSelection(optionsWith({ repos: [sshRepo] }))
    expect(selection.project).toEqual({ kind: 'none' })
  })

  it('starts on the preferred agent', () => {
    const selection = buildDefaultCreateChatSelection(optionsWith({ preferredAgent: 'codex' }))
    expect(selection.agent).toBe('codex')
  })
})

describe('withAvailableCreateChatAgent', () => {
  it('keeps an agent the host offers', () => {
    const selection = selectionWith({ agent: 'codex', model: 'gpt' })
    expect(withAvailableCreateChatAgent(selection, ['claude', 'codex'], null)).toBe(selection)
  })

  it('keeps the pick while the host has not listed its agents', () => {
    const selection = selectionWith({ agent: 'gemini' })
    expect(withAvailableCreateChatAgent(selection, [], null)).toBe(selection)
  })

  it('moves an agent the host does not offer to the preferred one, dropping its model', () => {
    const selection = selectionWith({ agent: 'gemini', model: 'gemini-pro', effort: 'high' })
    expect(withAvailableCreateChatAgent(selection, ['claude', 'pi'], 'pi')).toEqual({
      ...selection,
      agent: 'pi',
      model: undefined,
      effort: undefined
    })
  })

  it('falls back to the first offered agent when the preferred one is not offered', () => {
    const selection = selectionWith({ agent: 'aider' })
    expect(withAvailableCreateChatAgent(selection, ['codex'], 'gemini').agent).toBe('codex')
  })
})

describe('chooseCreateChatLocation', () => {
  it('moves the project to the first repo of the new location', () => {
    const next = chooseCreateChatLocation(selectionWith(), 'ssh:devbox', [localRepo, sshRepo])
    expect(next.executionHostId).toBe('ssh:devbox')
    expect(next.project).toEqual({ kind: 'repo', repoId: 'repo-ssh' })
  })

  it('keeps a projectless chat on this computer', () => {
    const projectless = selectionWith({ project: { kind: 'none' } })
    const next = chooseCreateChatLocation(projectless, 'local', [localRepo, sshRepo])
    expect(next.project).toEqual({ kind: 'none' })
  })

  it('drops a projectless chat that moves to a remote location without repos', () => {
    const projectless = selectionWith({ project: { kind: 'none' } })
    const next = chooseCreateChatLocation(projectless, 'ssh:empty', [localRepo, sshRepo])
    expect(next.project).toEqual({ kind: 'none' })
    expect(canSubmitCreateChat('Fix it', next, [localRepo, sshRepo])).toBe(false)
  })
})

describe('canSubmitCreateChat', () => {
  it('needs a non-blank draft', () => {
    expect(canSubmitCreateChat('   ', selectionWith(), [localRepo])).toBe(false)
    expect(canSubmitCreateChat('Fix the login bug', selectionWith(), [localRepo])).toBe(true)
  })

  it('allows projectless chats only on this computer', () => {
    const projectless = selectionWith({ project: { kind: 'none' } })
    expect(canSubmitCreateChat('Hi', projectless, [])).toBe(true)
    expect(canSubmitCreateChat('Hi', { ...projectless, executionHostId: 'ssh:devbox' }, [])).toBe(
      false
    )
    expect(canUseProjectless('ssh:devbox')).toBe(false)
  })

  it('rejects a project whose host differs from the selected location', () => {
    expect(
      canSubmitCreateChat('Hi', selectionWith({ executionHostId: 'ssh:devbox' }), [localRepo])
    ).toBe(false)
  })
})
