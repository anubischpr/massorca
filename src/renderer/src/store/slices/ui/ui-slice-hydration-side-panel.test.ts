import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIDE_PANEL_WIDTH,
  MAX_SIDE_PANEL_WIDTH,
  MIN_SIDE_PANEL_WIDTH
} from '../tabs/side-panel-state'
import { hydrateSidePanelState } from './ui-slice-hydration-side-panel'

describe('hydrateSidePanelState', () => {
  it('restores a saved width and the per-workspace open choices', () => {
    expect(
      hydrateSidePanelState({ sidePanelWidth: 420, sidePanelOpenByWorktree: { a: true, b: false } })
    ).toEqual({ sidePanelWidth: 420, sidePanelOpenByWorktree: { a: true, b: false } })
  })

  it('keeps profiles written before the panel existed on the defaults', () => {
    expect(hydrateSidePanelState({})).toEqual({
      sidePanelWidth: DEFAULT_SIDE_PANEL_WIDTH,
      sidePanelOpenByWorktree: {}
    })
  })

  it('clamps a stale width and drops malformed open entries', () => {
    expect(hydrateSidePanelState({ sidePanelWidth: 5 }).sidePanelWidth).toBe(MIN_SIDE_PANEL_WIDTH)
    expect(hydrateSidePanelState({ sidePanelWidth: 99999 }).sidePanelWidth).toBe(
      MAX_SIDE_PANEL_WIDTH
    )
    expect(hydrateSidePanelState({ sidePanelWidth: Number.NaN }).sidePanelWidth).toBe(
      DEFAULT_SIDE_PANEL_WIDTH
    )
    expect(
      hydrateSidePanelState({
        sidePanelOpenByWorktree: { ok: true, bad: 'yes' as unknown as boolean }
      }).sidePanelOpenByWorktree
    ).toEqual({ ok: true })
  })
})
