import { describe, expect, it } from 'vitest'

import {
  buildMobileNewTabAgentOptions,
  orderMobileNewTabAgents,
  promptLaunchAgentOptions
} from './mobile-new-tab-agent-options'

describe('mobile new-tab agent options', () => {
  it('orders the enabled detected default first', () => {
    expect(orderMobileNewTabAgents('codex', ['gemini', 'codex', 'claude'], ['gemini'])).toEqual([
      'codex',
      'claude'
    ])
  })

  it('returns labeled options for enabled detected agents only', () => {
    expect(
      buildMobileNewTabAgentOptions({ defaultTuiAgent: null, disabledTuiAgents: ['claude'] }, [
        'claude',
        'codex',
        'not-real'
      ])
    ).toEqual([{ agent: 'codex', label: 'Codex' }])
  })

  it('names the Pi row Gentle Shell when the host is configured for it', () => {
    expect(
      buildMobileNewTabAgentOptions(
        { defaultTuiAgent: null, agentCmdOverrides: { pi: 'gentle-shell' } },
        ['pi']
      )
    ).toEqual([{ agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }])
  })

  it('reads a Gentle Shell command path and keeps stock Pi for other or missing commands', () => {
    expect(
      buildMobileNewTabAgentOptions(
        { agentCmdOverrides: { pi: '/usr/local/bin/gentle-shell --profile work' } },
        ['pi']
      )
    ).toEqual([{ agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }])
    expect(buildMobileNewTabAgentOptions({ agentCmdOverrides: { pi: 'pi' } }, ['pi'])).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' }
    ])
    expect(buildMobileNewTabAgentOptions({ agentCmdOverrides: { pi: 42 } }, ['pi'])).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' }
    ])
    expect(buildMobileNewTabAgentOptions({ defaultTuiAgent: null }, ['pi'])).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' }
    ])
  })

  it('does not show stale presets while detection is pending', () => {
    expect(buildMobileNewTabAgentOptions({ defaultTuiAgent: 'codex' }, null)).toEqual([])
  })

  it('gives each Pi runtime the host has its own row with a unique label', () => {
    const options = buildMobileNewTabAgentOptions(
      { defaultTuiAgent: null },
      ['pi'],
      ['pi', 'gentle-shell']
    )

    expect(options).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' },
      { agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }
    ])
    expect(new Set(options.map((option) => option.label)).size).toBe(options.length)
  })

  it('names a host that has only Gentle Shell by Gentle Shell, with no Command setting', () => {
    expect(
      buildMobileNewTabAgentOptions({ defaultTuiAgent: null }, ['pi'], ['gentle-shell'])
    ).toEqual([{ agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }])
  })

  it('trusts the runtimes the host has over a Command setting that names another', () => {
    expect(
      buildMobileNewTabAgentOptions({ agentCmdOverrides: { pi: 'gentle-shell' } }, ['pi'], ['pi'])
    ).toEqual([{ agent: 'pi', label: 'Pi', piRuntime: 'pi' }])
  })

  it('keeps the single row named by the Command setting when the host names no runtime', () => {
    expect(
      buildMobileNewTabAgentOptions({ agentCmdOverrides: { pi: 'gentle-shell' } }, ['pi'], [])
    ).toEqual([{ agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' }])
    expect(buildMobileNewTabAgentOptions({ defaultTuiAgent: null }, ['pi'], null)).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' }
    ])
  })

  it('disables both Pi rows together, and a default Pi keeps both rows first', () => {
    expect(
      buildMobileNewTabAgentOptions(
        { disabledTuiAgents: ['pi'] },
        ['claude', 'pi'],
        ['pi', 'gentle-shell']
      )
    ).toEqual([{ agent: 'claude', label: 'Claude' }])
    expect(
      buildMobileNewTabAgentOptions(
        { defaultTuiAgent: 'pi' },
        ['claude', 'pi'],
        ['pi', 'gentle-shell']
      )
    ).toEqual([
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' },
      { agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' },
      { agent: 'claude', label: 'Claude' }
    ])
  })

  it('leads a default Pi with the row its Command setting names', () => {
    expect(
      buildMobileNewTabAgentOptions(
        { defaultTuiAgent: 'pi', agentCmdOverrides: { pi: 'gentle-shell' } },
        ['claude', 'pi'],
        ['pi', 'gentle-shell']
      )
    ).toEqual([
      { agent: 'pi', label: 'Gentle Shell', piRuntime: 'gentle-shell' },
      { agent: 'pi', label: 'Pi', piRuntime: 'pi' },
      { agent: 'claude', label: 'Claude' }
    ])
  })

  it('offers Gentle Shell for a prompt only when stock Pi is absent', () => {
    const both = buildMobileNewTabAgentOptions({}, ['pi'], ['pi', 'gentle-shell'])
    expect(promptLaunchAgentOptions(both)).toEqual([{ agent: 'pi', label: 'Pi', piRuntime: 'pi' }])

    const gentleShellOnly = buildMobileNewTabAgentOptions({}, ['pi'], ['gentle-shell'])
    expect(promptLaunchAgentOptions(gentleShellOnly)).toEqual(gentleShellOnly)
  })
})
