import { describe, expect, it } from 'vitest'
import type { MobileWorkspaceRepo } from '../components/new-worktree-modal-types'
import {
  buildCreateSessionLaunchPlan,
  createSessionProgressSteps,
  createSessionSeedOptions
} from './create-session-launch-plan'
import type { CreateSessionSelection } from './create-session-model'

const repo: MobileWorkspaceRepo = { id: 'web', displayName: 'web', path: '/work/web' }
const folder: MobileWorkspaceRepo = { ...repo, id: 'notes', kind: 'folder' }
const selection: CreateSessionSelection = {
  hostId: 'local',
  repoId: 'web',
  workspaceMode: 'new-worktree',
  agent: 'claude'
}

describe('createSessionSeedOptions', () => {
  it('sends nothing when nothing was picked', () => {
    expect(createSessionSeedOptions('claude', {}, 'opus')).toBeUndefined()
  })

  it('encodes every pick for the host', () => {
    expect(
      createSessionSeedOptions(
        'claude',
        { model: 'opus', effort: 'high', fastMode: true, accessMode: 'plan' },
        null
      )
    ).toEqual({ model: 'opus', effort: 'high', fastMode: 'true', accessMode: 'plan' })
  })

  it('pairs an effort pick with the model shown at the time', () => {
    expect(createSessionSeedOptions('claude', { effort: 'low' }, 'sonnet')).toEqual({
      model: 'sonnet',
      effort: 'low'
    })
  })

  it('does not invent a model for an access-only pick', () => {
    expect(createSessionSeedOptions('claude', { accessMode: 'plan' }, 'sonnet')).toEqual({
      accessMode: 'plan'
    })
  })

  it('never seeds OpenCode, whose launch the host refuses with options', () => {
    expect(createSessionSeedOptions('opencode', { model: 'x', accessMode: 'plan' }, null)).toBe(
      undefined
    )
  })

  it('drops an access mode the host does not know', () => {
    expect(createSessionSeedOptions('claude', { accessMode: 'bogus' }, null)).toBeUndefined()
  })
})

describe('buildCreateSessionLaunchPlan', () => {
  const args = {
    draft: '  fix the login bug  ',
    selection,
    repo,
    picks: {},
    effectiveModelId: null
  }

  it('trims the first message and keeps the workspace mode', () => {
    expect(buildCreateSessionLaunchPlan(args)).toEqual({
      kind: 'new-worktree',
      repoId: 'web',
      agent: 'claude',
      prompt: 'fix the login bug'
    })
  })

  it('runs a folder in place whatever the chip says', () => {
    expect(buildCreateSessionLaunchPlan({ ...args, repo: folder })?.kind).toBe('current-checkout')
  })

  it('refuses a plan without text, project or agent', () => {
    expect(buildCreateSessionLaunchPlan({ ...args, draft: ' ' })).toBeNull()
    expect(buildCreateSessionLaunchPlan({ ...args, repo: null })).toBeNull()
    expect(
      buildCreateSessionLaunchPlan({ ...args, selection: { ...selection, agent: null } })
    ).toBeNull()
  })

  it('carries the picked options', () => {
    expect(
      buildCreateSessionLaunchPlan({ ...args, picks: { accessMode: 'accept-edits' } })
        ?.sessionOptions
    ).toEqual({ accessMode: 'accept-edits' })
  })
})

describe('createSessionProgressSteps', () => {
  it('shows the worktree steps for a new worktree', () => {
    expect(
      createSessionProgressSteps({ kind: 'new-worktree' }, 'Claude').map((step) => step.label)
    ).toEqual(['Creating the worktree', 'Running setup in the background', 'Starting Claude'])
  })

  it('skips them for the current checkout', () => {
    expect(
      createSessionProgressSteps({ kind: 'current-checkout' }, 'Codex').map((step) => step.label)
    ).toEqual(['Starting Codex'])
  })
})
