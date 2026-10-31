import { describe, expect, it } from 'vitest'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import { livePtyIdForSessionPane, sessionHoverPrompt } from './worktree-card-one-line-session-hover'

const LEAF = '22222222-2222-4222-8222-222222222222'
const TAB = 'tab-a'
const PANE = makePaneKey(TAB, LEAF)
const APPROVAL = JSON.stringify({ approval: { tool: 'Bash', summary: 'git status' } })

describe('livePtyIdForSessionPane', () => {
  it('reads the pane leaf PTY from the store while the tab is not mounted', () => {
    expect(livePtyIdForSessionPane(PANE, { [LEAF]: 'pty-1' }, ['pty-1'])).toBe('pty-1')
  })

  it('returns null for a stale layout PTY that is no longer live', () => {
    expect(livePtyIdForSessionPane(PANE, { [LEAF]: 'pty-old' }, ['pty-new'])).toBeNull()
  })
})

describe('sessionHoverPrompt', () => {
  const waiting = { interactivePrompt: APPROVAL, toolName: 'Bash', agentType: 'claude' as const }

  it('offers the structured prompt for a needs-human session with a live PTY', () => {
    const hover = sessionHoverPrompt({
      ownGlyph: 'needs-human',
      dimmed: false,
      ptyId: 'pty-1',
      entry: waiting
    })

    expect(hover?.card.kind).toBe('approval')
    expect(hover?.agentType).toBe('claude')
  })

  it('shows Environment, not a prompt, for hook status without a structured prompt', () => {
    expect(
      sessionHoverPrompt({
        ownGlyph: 'needs-human',
        dimmed: false,
        ptyId: 'pty-1',
        entry: { agentType: 'claude', interactivePrompt: undefined }
      })
    ).toBeNull()
  })

  it('shows Environment for a session that is not waiting on the user', () => {
    expect(
      sessionHoverPrompt({ ownGlyph: 'working', dimmed: false, ptyId: 'pty-1', entry: waiting })
    ).toBeNull()
  })

  it('shows Environment on an unreachable host and without a live PTY', () => {
    expect(
      sessionHoverPrompt({ ownGlyph: 'needs-human', dimmed: true, ptyId: 'pty-1', entry: waiting })
    ).toBeNull()
    expect(
      sessionHoverPrompt({ ownGlyph: 'needs-human', dimmed: false, ptyId: null, entry: waiting })
    ).toBeNull()
  })
})
