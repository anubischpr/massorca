import { describe, expect, it } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  buildCreateSessionHostOptions,
  buildDefaultCreateSessionSelection,
  buildWorkspaceModeChoices,
  canSubmitCreateSession,
  chooseCreateSessionHost,
  chooseCreateSessionRepo,
  createSessionFootnote,
  effectiveWorkspaceMode,
  selectableCreateSessionAgents,
  withAvailableCreateSessionAgent,
  showsBaseRefChip,
  workspaceModeChipLabel,
  type CreateSessionSelection
} from './create-session-model'

function repo(id: string, extra: Partial<MobileWorkspaceRepo> = {}): MobileWorkspaceRepo {
  return { id, displayName: id, path: `/work/${id}`, ...extra }
}

const local = repo('web')
const other = repo('api')
const remote = repo('infra', { connectionId: 'vps' })
const notes = repo('notes', { kind: 'folder' })
const repos = [local, remote, other, notes]

const base: CreateSessionSelection = {
  hostId: 'local',
  repoId: 'web',
  workspaceMode: 'new-worktree',
  agent: 'claude',
  baseRef: null
}

describe('create session host options', () => {
  it('lists each host once, the paired computer first, with project counts', () => {
    const options = buildCreateSessionHostOptions([remote, local, other], {
      hostLabelById: new Map([['ssh:vps', 'srv2056164']]),
      hostPlatform: 'linux'
    })
    expect(options.map((option) => [option.id, option.label, option.detail])).toEqual([
      ['local', 'Local Linux', '2 projects'],
      ['ssh:vps', 'srv2056164', '1 project']
    ])
  })

  it('falls back to the target id when the host has no label', () => {
    const [option] = buildCreateSessionHostOptions([remote], {
      hostLabelById: new Map(),
      hostPlatform: null
    })
    expect(option?.label).toBe('vps')
  })
})

describe('create session selection', () => {
  it('defaults to the last visited project and its host', () => {
    expect(buildDefaultCreateSessionSelection({ repos, lastVisitedRepoId: 'infra' })).toEqual({
      hostId: 'ssh:vps',
      repoId: 'infra',
      workspaceMode: 'new-worktree',
      agent: null,
      baseRef: null
    })
  })

  it('has no project when the host lists none', () => {
    expect(buildDefaultCreateSessionSelection({ repos: [], lastVisitedRepoId: null })).toEqual({
      hostId: 'local',
      repoId: null,
      workspaceMode: 'new-worktree',
      agent: null,
      baseRef: null
    })
  })

  it('keeps the project when it runs on the chosen host', () => {
    expect(chooseCreateSessionHost(base, 'local', repos)).toEqual(base)
  })

  it('moves to the first project of another host and forgets the agent', () => {
    expect(chooseCreateSessionHost(base, 'ssh:vps', repos)).toMatchObject({
      hostId: 'ssh:vps',
      repoId: 'infra',
      agent: null
    })
  })

  it('choosing a project on another host moves the host too', () => {
    expect(chooseCreateSessionRepo(base, 'infra', repos)).toMatchObject({
      hostId: 'ssh:vps',
      repoId: 'infra',
      agent: null
    })
  })

  it('keeps the agent when the project stays on the same host', () => {
    expect(chooseCreateSessionRepo(base, 'api', repos).agent).toBe('claude')
  })

  it('ignores a project the host no longer lists', () => {
    expect(chooseCreateSessionRepo(base, 'gone', repos)).toBe(base)
  })
})

describe('create session base branch', () => {
  const picked = { ...base, baseRef: 'origin/release' }

  it('keeps the pick while the project stays', () => {
    expect(chooseCreateSessionHost(picked, 'local', repos).baseRef).toBe('origin/release')
    expect(chooseCreateSessionRepo(picked, 'web', repos).baseRef).toBe('origin/release')
  })

  it('forgets the pick when the project or the host changes', () => {
    expect(chooseCreateSessionRepo(picked, 'api', repos).baseRef).toBeNull()
    expect(chooseCreateSessionRepo(picked, 'infra', repos).baseRef).toBeNull()
    expect(chooseCreateSessionHost(picked, 'ssh:vps', repos).baseRef).toBeNull()
  })

  it('shows the chip only for a new worktree in a git project', () => {
    expect(showsBaseRefChip(base, local)).toBe(true)
    expect(showsBaseRefChip({ ...base, workspaceMode: 'current-checkout' }, local)).toBe(false)
    expect(showsBaseRefChip(base, notes)).toBe(false)
    expect(showsBaseRefChip(base, null)).toBe(false)
  })
})

describe('create session workspace mode', () => {
  it('forces a folder to run in place and disables both choices', () => {
    expect(effectiveWorkspaceMode(base, notes)).toBe('current-checkout')
    expect(workspaceModeChipLabel(base, notes)).toBe('No Git')
    expect(buildWorkspaceModeChoices(notes).every((choice) => choice.disabled)).toBe(true)
  })

  it('offers both choices for a git project', () => {
    expect(buildWorkspaceModeChoices(local).map((choice) => choice.disabled)).toEqual([
      false,
      false
    ])
    expect(workspaceModeChipLabel({ ...base, workspaceMode: 'current-checkout' }, local)).toBe(
      'Current checkout'
    )
  })
})

describe('create session agents', () => {
  const catalog = [{ id: 'claude' as const }, { id: 'codex' as const }, { id: 'gemini' as const }]

  it('keeps detected, enabled agents only', () => {
    expect(
      selectableCreateSessionAgents(catalog, {
        detectedAgentIds: new Set(['claude', 'gemini']),
        isEnabled: (agent) => agent !== 'gemini'
      })
    ).toEqual(['claude'])
  })

  it('lists every enabled agent while detection is still running', () => {
    expect(
      selectableCreateSessionAgents(catalog, { detectedAgentIds: null, isEnabled: () => true })
    ).toEqual(['claude', 'codex', 'gemini'])
  })

  it('keeps a still-available agent', () => {
    expect(withAvailableCreateSessionAgent(base, ['codex', 'claude'], 'codex')).toBe(base)
  })

  it('moves to the preferred agent, else the first, when the pick is gone', () => {
    expect(withAvailableCreateSessionAgent(base, ['gemini', 'codex'], 'codex').agent).toBe('codex')
    expect(withAvailableCreateSessionAgent(base, ['gemini', 'codex'], 'claude').agent).toBe(
      'gemini'
    )
  })

  it('clears the pick when the host has no agent', () => {
    expect(withAvailableCreateSessionAgent(base, [], null).agent).toBeNull()
  })
})

describe('canSubmitCreateSession', () => {
  const ready = { draft: 'fix it', selection: base, repos, sshReady: true, busy: false }

  it('needs text, an agent, a project on the chosen host and a ready connection', () => {
    expect(canSubmitCreateSession(ready)).toBe(true)
    expect(canSubmitCreateSession({ ...ready, draft: '   ' })).toBe(false)
    expect(canSubmitCreateSession({ ...ready, selection: { ...base, agent: null } })).toBe(false)
    expect(canSubmitCreateSession({ ...ready, sshReady: false })).toBe(false)
    expect(canSubmitCreateSession({ ...ready, busy: true })).toBe(false)
    expect(canSubmitCreateSession({ ...ready, selection: { ...base, hostId: 'ssh:vps' } })).toBe(
      false
    )
    expect(canSubmitCreateSession({ ...ready, selection: { ...base, repoId: 'gone' } })).toBe(false)
  })
})

describe('createSessionFootnote', () => {
  it('names the project and host', () => {
    expect(createSessionFootnote(base, local, 'Linux')).toBe('New worktree on web · Linux')
    expect(
      createSessionFootnote({ ...base, workspaceMode: 'current-checkout' }, local, 'Linux')
    ).toBe('Runs in web · Linux')
    expect(createSessionFootnote(base, notes, 'Linux')).toBe('Runs in notes · Linux')
  })
})
