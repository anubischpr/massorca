import { describe, expect, it } from 'vitest'

import {
  buildMobileNewTabAgentOptions,
  orderMobileNewTabAgents
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
})
