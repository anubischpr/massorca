import { describe, expect, it } from 'vitest'

import {
  NEW_WORKTREE_BLANK_AGENT,
  newWorktreeAgentOptionFor,
  newWorktreeAgentRowKey,
  newWorktreeAgentRows,
  pickPreferredNewWorktreeAgent,
  resolveNewWorktreeAgentSelection
} from './new-worktree-agent-selection'

describe('new worktree agent selection', () => {
  it('picks the preferred detected agent when there is no user override', () => {
    const selected = newWorktreeAgentOptionFor('claude')
    const resolved = resolveNewWorktreeAgentSelection({
      visible: true,
      selectedAgent: selected,
      agentOverridden: false,
      runtimeSettings: { defaultTuiAgent: 'codex' },
      detectedAgentIds: new Set(['claude', 'codex'])
    })

    expect(resolved).toEqual({
      selectedAgent: newWorktreeAgentOptionFor('codex'),
      agentOverridden: false
    })
  })

  it('keeps an available user override', () => {
    const selected = newWorktreeAgentOptionFor('codex')
    const resolved = resolveNewWorktreeAgentSelection({
      visible: true,
      selectedAgent: selected,
      agentOverridden: true,
      runtimeSettings: { defaultTuiAgent: 'claude' },
      detectedAgentIds: new Set(['claude', 'codex'])
    })

    expect(resolved).toEqual({ selectedAgent: selected, agentOverridden: true })
  })

  it('clears an unavailable user override after detection completes', () => {
    const resolved = resolveNewWorktreeAgentSelection({
      visible: true,
      selectedAgent: newWorktreeAgentOptionFor('codex'),
      agentOverridden: true,
      runtimeSettings: { defaultTuiAgent: 'claude' },
      detectedAgentIds: new Set(['claude'])
    })

    expect(resolved).toEqual({
      selectedAgent: newWorktreeAgentOptionFor('claude'),
      agentOverridden: false
    })
  })

  it('clears a disabled user override after detection completes', () => {
    const resolved = resolveNewWorktreeAgentSelection({
      visible: true,
      selectedAgent: newWorktreeAgentOptionFor('codex'),
      agentOverridden: true,
      runtimeSettings: { defaultTuiAgent: 'claude', disabledTuiAgents: ['codex'] },
      detectedAgentIds: new Set(['claude', 'codex'])
    })

    expect(resolved).toEqual({
      selectedAgent: newWorktreeAgentOptionFor('claude'),
      agentOverridden: false
    })
  })

  it('keeps blank terminal as an explicit override', () => {
    const resolved = resolveNewWorktreeAgentSelection({
      visible: true,
      selectedAgent: NEW_WORKTREE_BLANK_AGENT,
      agentOverridden: true,
      runtimeSettings: { defaultTuiAgent: 'claude' },
      detectedAgentIds: new Set(['claude'])
    })

    expect(resolved).toEqual({
      selectedAgent: NEW_WORKTREE_BLANK_AGENT,
      agentOverridden: true
    })
  })

  it('leaves closed modal state untouched', () => {
    const selected = newWorktreeAgentOptionFor('codex')
    const resolved = resolveNewWorktreeAgentSelection({
      visible: false,
      selectedAgent: selected,
      agentOverridden: true,
      runtimeSettings: { defaultTuiAgent: 'claude' },
      detectedAgentIds: new Set(['claude'])
    })

    expect(resolved).toEqual({ selectedAgent: selected, agentOverridden: true })
  })

  it('uses blank when no detected agent is known', () => {
    expect(pickPreferredNewWorktreeAgent({ defaultTuiAgent: null }, new Set()).id).toBe('__blank__')
  })

  it('splits the Pi entry into a row per Pi runtime the host has, with unique keys', () => {
    const rows = newWorktreeAgentRows(new Set(['claude', 'pi']), ['pi', 'gentle-shell'], null)

    expect(rows.filter((row) => row.id === 'pi').map((row) => [row.label, row.piRuntime])).toEqual([
      ['Pi', 'pi'],
      ['Gentle Shell', 'gentle-shell']
    ])
    expect(new Set(rows.map(newWorktreeAgentRowKey)).size).toBe(rows.length)
  })

  it('lists only Gentle Shell when it is the only Pi runtime the host has', () => {
    expect(newWorktreeAgentRows(new Set(['pi']), ['gentle-shell'], null)).toEqual([
      expect.objectContaining({ id: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' })
    ])
  })

  it('names the Pi row from the Command setting when the host did not say which runtime it has', () => {
    expect(
      newWorktreeAgentRows(new Set(['pi']), null, { agentCmdOverrides: { pi: 'gentle-shell' } })
    ).toEqual([
      expect.objectContaining({ id: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' })
    ])
  })

  it('preselects the Gentle Shell row when it is the only Pi runtime and the default agent is Pi', () => {
    const rows = newWorktreeAgentRows(new Set(['pi']), ['gentle-shell'], null)

    expect(pickPreferredNewWorktreeAgent({ defaultTuiAgent: 'pi' }, new Set(['pi']), rows)).toEqual(
      rows[0]
    )
  })

  it('preselects the Pi row the Command setting names when the host has both Pi runtimes', () => {
    const detected = new Set(['pi'])
    const rows = newWorktreeAgentRows(detected, ['pi', 'gentle-shell'], {
      agentCmdOverrides: { pi: 'gentle-shell' }
    })
    const runtimeSettings = {
      defaultTuiAgent: 'pi' as const,
      agentCmdOverrides: { pi: 'gentle-shell' }
    }

    expect(pickPreferredNewWorktreeAgent(runtimeSettings, detected, rows)).toEqual(rows[1])
    expect(
      resolveNewWorktreeAgentSelection({
        visible: true,
        selectedAgent: rows[0],
        agentOverridden: false,
        runtimeSettings,
        detectedAgentIds: detected,
        rows
      }).selectedAgent
    ).toEqual(rows[1])
  })

  it('preselects the stock Pi row when the Command setting names stock Pi or nothing', () => {
    const detected = new Set(['pi'])
    const rows = newWorktreeAgentRows(detected, ['pi', 'gentle-shell'], null)

    expect(pickPreferredNewWorktreeAgent({ defaultTuiAgent: 'pi' }, detected, rows)).toEqual(
      rows[0]
    )
    expect(
      pickPreferredNewWorktreeAgent(
        { defaultTuiAgent: 'pi', agentCmdOverrides: { pi: 'pi' } },
        detected,
        rows
      )
    ).toEqual(rows[0])
  })

  it('keeps a Gentle Shell override only while the host still has Gentle Shell', () => {
    const detected = new Set(['pi'])
    const bothRows = newWorktreeAgentRows(detected, ['pi', 'gentle-shell'], null)
    const gentleShell = bothRows.find((row) => row.piRuntime === 'gentle-shell')!
    const piOnlyRows = newWorktreeAgentRows(detected, ['pi'], null)

    expect(
      resolveNewWorktreeAgentSelection({
        visible: true,
        selectedAgent: gentleShell,
        agentOverridden: true,
        runtimeSettings: { defaultTuiAgent: 'pi' },
        detectedAgentIds: detected,
        rows: bothRows
      })
    ).toEqual({ selectedAgent: gentleShell, agentOverridden: true })
    expect(
      resolveNewWorktreeAgentSelection({
        visible: true,
        selectedAgent: gentleShell,
        agentOverridden: true,
        runtimeSettings: { defaultTuiAgent: 'pi' },
        detectedAgentIds: detected,
        rows: piOnlyRows
      })
    ).toEqual({ selectedAgent: piOnlyRows[0], agentOverridden: false })
  })
})
