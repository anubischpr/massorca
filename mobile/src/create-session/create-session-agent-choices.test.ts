import { describe, expect, it, vi } from 'vitest'
import type { PiRuntimeSelection } from '../../../src/shared/pi-runtime-selection'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import {
  buildCreateSessionAgentChoices,
  createSessionAgentChoiceValue,
  readPiRuntimeReport,
  withAvailableCreateSessionChoice,
  type CreateSessionAgentChoiceInputs
} from './create-session-agent-choices'
import type { CreateSessionSelection } from './create-session-model'
import {
  readCreateSessionPiRuntimes,
  type PiRuntimeRequest
} from './use-create-session-pi-runtimes'

const catalog: CreateSessionAgentChoiceInputs['catalog'] = [
  { id: 'claude', label: 'Claude' },
  { id: 'pi', label: 'Pi' },
  { id: 'antigravity', label: 'Antigravity' }
]

function inputs(
  overrides: Partial<CreateSessionAgentChoiceInputs> = {}
): CreateSessionAgentChoiceInputs {
  return {
    catalog,
    detectedAgentIds: new Set<string>(['claude', 'pi', 'antigravity']),
    isEnabled: () => true,
    piRuntimes: null,
    piCommand: undefined,
    ...overrides
  }
}

function labelsOf(choices: ReturnType<typeof buildCreateSessionAgentChoices>): string[] {
  return choices.map((choice) => choice.label)
}

describe('buildCreateSessionAgentChoices Pi rows', () => {
  it('offers only Gentle Shell when the host reports only Gentle Shell', () => {
    const choices = buildCreateSessionAgentChoices(inputs({ piRuntimes: ['gentle-shell'] }))
    expect(labelsOf(choices)).toEqual(['Claude', 'Gentle Shell', 'Antigravity'])
    expect(choices.find((choice) => choice.agent === 'pi')).toMatchObject({
      value: 'pi:gentle-shell',
      piRuntime: 'gentle-shell'
    })
  })

  it('splits Pi into one row per runtime the host reports, in its order', () => {
    const choices = buildCreateSessionAgentChoices(inputs({ piRuntimes: ['pi', 'gentle-shell'] }))
    expect(labelsOf(choices)).toEqual(['Claude', 'Pi', 'Gentle Shell', 'Antigravity'])
    expect(choices.filter((choice) => choice.agent === 'pi').map((choice) => choice.value)).toEqual(
      ['pi:pi', 'pi:gentle-shell']
    )
  })

  it('keeps one Pi row named by the configured command when the host reports nothing', () => {
    expect(labelsOf(buildCreateSessionAgentChoices(inputs({ piRuntimes: null })))).toContain('Pi')
    expect(
      labelsOf(
        buildCreateSessionAgentChoices(
          inputs({ piRuntimes: null, piCommand: '/usr/bin/gentle-shell --session x' })
        )
      )
    ).toContain('Gentle Shell')
  })

  it('treats an empty report like no report', () => {
    expect(labelsOf(buildCreateSessionAgentChoices(inputs({ piRuntimes: [] })))).toEqual(
      labelsOf(buildCreateSessionAgentChoices(inputs({ piRuntimes: null })))
    )
  })

  it('offers no Pi row when Pi was not detected or is disabled', () => {
    const notDetected = inputs({
      piRuntimes: ['pi'],
      detectedAgentIds: new Set(['claude', 'antigravity'])
    })
    expect(labelsOf(buildCreateSessionAgentChoices(notDetected))).toEqual(['Claude', 'Antigravity'])
    const disabled = inputs({ piRuntimes: ['pi'], isEnabled: (agent) => agent !== 'pi' })
    expect(labelsOf(buildCreateSessionAgentChoices(disabled))).toEqual(['Claude', 'Antigravity'])
  })

  it('keeps every agent row while detection is still running', () => {
    expect(
      labelsOf(buildCreateSessionAgentChoices(inputs({ detectedAgentIds: null, piRuntimes: null })))
    ).toEqual(['Claude', 'Pi', 'Antigravity'])
  })

  it('leaves non-Pi rows without a runtime', () => {
    const claude = buildCreateSessionAgentChoices(inputs()).find(
      (choice) => choice.agent === 'claude'
    )
    expect(claude).toEqual({ value: 'claude', agent: 'claude', piRuntime: null, label: 'Claude' })
  })
})

describe('readPiRuntimeReport', () => {
  it('keeps known runtimes once, in order', () => {
    expect(readPiRuntimeReport(['pi', 'bogus', 'gentle-shell', 'pi'])).toEqual([
      'pi',
      'gentle-shell'
    ])
  })

  it('reads anything that is not a list as no report', () => {
    expect(readPiRuntimeReport({ runtimes: ['pi'] })).toBeNull()
    expect(readPiRuntimeReport(undefined)).toBeNull()
  })
})

describe('withAvailableCreateSessionChoice', () => {
  const selection: CreateSessionSelection = {
    hostId: 'local',
    repoId: 'web',
    workspaceMode: 'new-worktree',
    agent: 'pi',
    piRuntime: 'gentle-shell',
    baseRef: null
  }
  const both = buildCreateSessionAgentChoices(inputs({ piRuntimes: ['pi', 'gentle-shell'] }))
  const onlyClaude = buildCreateSessionAgentChoices(
    inputs({ detectedAgentIds: new Set(['claude']) })
  )

  it('keeps the exact row the selection names', () => {
    expect(withAvailableCreateSessionChoice(selection, both, 'claude')).toBe(selection)
  })

  it('moves a Pi selection to the other runtime when its row is gone', () => {
    const stockOnly = buildCreateSessionAgentChoices(inputs({ piRuntimes: ['pi'] }))
    expect(withAvailableCreateSessionChoice(selection, stockOnly, null)).toMatchObject({
      agent: 'pi',
      piRuntime: 'pi'
    })
  })

  it('moves to the preferred agent, else the first row, when the pick is gone', () => {
    expect(withAvailableCreateSessionChoice(selection, onlyClaude, 'claude')).toMatchObject({
      agent: 'claude',
      piRuntime: null
    })
    expect(withAvailableCreateSessionChoice(selection, onlyClaude, null).agent).toBe('claude')
  })

  it('clears the pick when no row is left', () => {
    expect(withAvailableCreateSessionChoice(selection, [], null)).toMatchObject({
      agent: null,
      piRuntime: null
    })
  })
})

describe('createSessionAgentChoiceValue', () => {
  it('names a Pi row by its runtime and leaves other agents bare', () => {
    const pi: TuiAgent = 'pi'
    const runtime: PiRuntimeSelection = 'gentle-shell'
    expect(createSessionAgentChoiceValue(pi, runtime)).toBe('pi:gentle-shell')
    expect(createSessionAgentChoiceValue('claude', null)).toBe('claude')
  })
})

describe('readCreateSessionPiRuntimes', () => {
  it('asks the local host for its Pi runtimes', async () => {
    const request = vi.fn<PiRuntimeRequest>(() => Promise.resolve(['pi', 'gentle-shell']))
    await expect(readCreateSessionPiRuntimes(request, null)).resolves.toEqual([
      'pi',
      'gentle-shell'
    ])
    expect(request.mock.calls[0]?.[0]).toBe('preflight.detectPiRuntimes')
  })

  it('asks an SSH host for its Pi runtimes by connection', async () => {
    const request = vi.fn<PiRuntimeRequest>(() => Promise.resolve(['gentle-shell']))
    await readCreateSessionPiRuntimes(request, 'ssh-1')
    expect(request.mock.calls[0]?.[0]).toBe('preflight.detectRemotePiRuntimes')
    expect(request.mock.calls[0]?.[1]).toEqual({ connectionId: 'ssh-1' })
  })

  it('reads a refused request from an older host as no runtime information', async () => {
    const request = vi.fn(() => Promise.reject(new Error('method_not_found')))
    await expect(readCreateSessionPiRuntimes(request, null)).resolves.toBeNull()
  })

  it('reads a malformed answer as no runtime information', async () => {
    const request = vi.fn(() => Promise.resolve({ runtimes: ['pi'] }))
    await expect(readCreateSessionPiRuntimes(request, null)).resolves.toBeNull()
  })
})
