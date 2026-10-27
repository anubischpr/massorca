import { describe, expect, it } from 'vitest'
import type { SetupHookDetails } from '../components/new-worktree-modal-types'
import { createSessionLaunchBlocker, resolveCreateSessionSetup } from './create-session-readiness'

const trust = { contentHash: 'hash-1', scriptContent: 'pnpm install' }

function details(extra: Partial<SetupHookDetails> = {}): SetupHookDetails {
  return {
    repoId: 'web',
    command: 'pnpm install',
    source: 'orca.yaml',
    trust,
    runPolicy: 'run-by-default',
    ...extra
  }
}

const trustedSetup = { web: { setup: { contentHash: 'hash-1', approvedAt: 1 } } }

describe('resolveCreateSessionSetup', () => {
  it('leaves the choice to the host when the project has no script', () => {
    expect(
      resolveCreateSessionSetup({ details: details({ command: null }), trustedHooks: {} })
    ).toEqual({ decision: 'inherit', notice: null })
  })

  it('never runs a script nobody approved, and says so', () => {
    const setup = resolveCreateSessionSetup({ details: details(), trustedHooks: {} })
    expect(setup.decision).toBe('skip')
    expect(setup.notice).toMatch(/not trusted yet/)
  })

  it('skips a script whose approved content has since changed', () => {
    const stale = { web: { setup: { contentHash: 'old', approvedAt: 1 } } }
    expect(resolveCreateSessionSetup({ details: details(), trustedHooks: stale }).decision).toBe(
      'skip'
    )
  })

  it('skips a script with no content hash to approve', () => {
    const setup = resolveCreateSessionSetup({
      details: details({ trust: null }),
      trustedHooks: trustedSetup
    })
    expect(setup.decision).toBe('skip')
  })

  it('runs an approved script when the project runs it by default', () => {
    expect(resolveCreateSessionSetup({ details: details(), trustedHooks: trustedSetup })).toEqual({
      decision: 'run',
      notice: null
    })
  })

  it('accepts a project-wide approval', () => {
    const all = { web: { all: { approvedAt: 1 } } }
    expect(resolveCreateSessionSetup({ details: details(), trustedHooks: all }).decision).toBe(
      'run'
    )
  })

  it('skips an approved script when the project skips by default, without a notice', () => {
    expect(
      resolveCreateSessionSetup({
        details: details({ runPolicy: 'skip-by-default' }),
        trustedHooks: trustedSetup
      })
    ).toEqual({ decision: 'skip', notice: null })
  })

  it('skips a project that asks every time, since the phone cannot ask here', () => {
    const setup = resolveCreateSessionSetup({
      details: details({ runPolicy: 'ask' }),
      trustedHooks: trustedSetup
    })
    expect(setup.decision).toBe('skip')
    expect(setup.notice).toMatch(/asks before running/)
  })

  it('skips when the hooks could not be read', () => {
    expect(resolveCreateSessionSetup({ details: null, trustedHooks: {} })).toEqual({
      decision: 'skip',
      notice: null
    })
  })
})

describe('createSessionLaunchBlocker', () => {
  it('waits while the host is still being read', () => {
    expect(createSessionLaunchBlocker({ support: null, workspaceMode: 'new-worktree' })).toBeNull()
  })

  it('points an older host at the full form', () => {
    const message = createSessionLaunchBlocker({ support: false, workspaceMode: 'new-worktree' })
    expect(message).toMatch(/Update MassOrca/)
    expect(message).toMatch(/Name, branch and setup script/)
  })

  it('needs replay support for the current checkout only', () => {
    const support = { replay: false }
    expect(createSessionLaunchBlocker({ support, workspaceMode: 'new-worktree' })).toBeNull()
    expect(createSessionLaunchBlocker({ support, workspaceMode: 'current-checkout' })).toMatch(
      /New worktree/
    )
    expect(
      createSessionLaunchBlocker({ support: { replay: true }, workspaceMode: 'current-checkout' })
    ).toBeNull()
  })
})
