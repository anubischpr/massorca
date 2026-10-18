import { describe, expect, it } from 'vitest'
import { CODEX_SESSION_OPTION_CATALOG } from './agent-session-option-catalog-claude-codex'
import {
  applyStructuredAgentSessionOptions,
  canSetStructuredAgentSessionOption,
  commitStructuredAgentSessionOption,
  createStructuredAgentSessionOptionState,
  structuredAgentSessionOptionPicks,
  structuredAgentSessionOptionSnapshot
} from './structured-agent-session-options'
import { structuredAgentSessionOptionView } from './structured-agent-session-option-view'
import {
  createAccessModeFor,
  lockStructuredAgentSessionAccessOptions
} from './structured-agent-session-access-option'

const MODES = ['default', 'full-access'] as const

describe('model-independent access options', () => {
  it.each([null, CODEX_SESSION_OPTION_CATALOG])(
    'offers access before model discovery',
    (catalog) => {
      const state = createStructuredAgentSessionOptionState('codex', catalog, MODES)
      expect(structuredAgentSessionOptionSnapshot(state)).toContainEqual(
        expect.objectContaining({
          id: 'accessMode',
          settable: true,
          kind: {
            type: 'select',
            currentValue: 'inherit',
            choices: [
              { value: 'inherit', label: 'inherit' },
              { value: 'default', label: 'default' },
              { value: 'full-access', label: 'full-access' }
            ]
          }
        })
      )
      expect(canSetStructuredAgentSessionOption(state, 'accessMode', 'default')).toBe(true)
    }
  )

  it('keeps held and seeded access per session, independent of model picks', () => {
    const first = createStructuredAgentSessionOptionState(
      'codex',
      CODEX_SESSION_OPTION_CATALOG,
      MODES
    )
    const second = createStructuredAgentSessionOptionState('codex', null, MODES)
    const view = structuredAgentSessionOptionView(
      first,
      { accessMode: 'default' },
      { accessMode: 'full-access' }
    )
    expect(view.record.accessMode?.value).toBe('full-access')
    expect(first.record.accessMode).toBeUndefined()
    expect(second.record.accessMode).toBeUndefined()
    const picked = commitStructuredAgentSessionOption(first, 'accessMode', 'default')
    expect(structuredAgentSessionOptionPicks(picked, { accessMode: 'default' })).toEqual([])
    const reported = applyStructuredAgentSessionOptions(picked, CODEX_SESSION_OPTION_CATALOG, {
      models: [],
      current: { model: 'another-model', accessMode: 'default' },
      accessModeSupport: { modes: MODES, settable: true }
    })
    expect(reported.record.accessMode?.value).toBe('default')
    expect(second.record.accessMode).toBeUndefined()
  })

  it('locks live access and omits unsupported presets and unclaimed capability', () => {
    const state = createStructuredAgentSessionOptionState('pi', null, ['full-access'])
    expect(canSetStructuredAgentSessionOption(state, 'accessMode', 'default')).toBe(false)
    expect(
      commitStructuredAgentSessionOption(state, 'accessMode', 'default').record.accessMode
    ).toBeUndefined()
    const live = applyStructuredAgentSessionOptions(state, CODEX_SESSION_OPTION_CATALOG, {
      models: [],
      current: { accessMode: 'inherit' },
      accessModeSupport: { modes: ['full-access'], settable: false }
    })
    expect(canSetStructuredAgentSessionOption(live, 'accessMode', 'full-access')).toBe(false)
    expect(structuredAgentSessionOptionSnapshot(live)[0]).toMatchObject({
      id: 'accessMode',
      settable: false
    })
    expect(
      structuredAgentSessionOptionSnapshot(createStructuredAgentSessionOptionState('opencode'))
    ).toEqual([])
  })

  it('keeps a seed-only access pick visible when the saved model is absent from the host list', () => {
    const state = createStructuredAgentSessionOptionState(
      'codex',
      CODEX_SESSION_OPTION_CATALOG,
      MODES
    )
    const host = { ...state, catalogSource: 'host' as const }
    const view = structuredAgentSessionOptionView(
      host,
      { model: 'retired-model', accessMode: 'default' },
      {}
    )
    expect(view.catalogSource).toBe('seed')
    expect(
      structuredAgentSessionOptionSnapshot(view).find((option) => option.id === 'accessMode')
    ).toMatchObject({
      kind: { currentValue: 'default' },
      valueSource: 'dispatched'
    })
    expect(state.record.accessMode).toBeUndefined()
    expect(view.record.model).toBeUndefined()
  })

  it('offers only full access for a provider with no restricted mode, even over a stored inherit', () => {
    const reported = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('pi', null, ['full-access']),
      CODEX_SESSION_OPTION_CATALOG,
      {
        models: [],
        current: { accessMode: 'inherit' },
        accessModeSupport: { modes: ['full-access'], settable: true }
      }
    )
    expect(
      structuredAgentSessionOptionSnapshot(reported).find((option) => option.id === 'accessMode')
    ).toMatchObject({
      settable: true,
      note: 'no-restricted-mode',
      valueSource: 'default',
      kind: {
        type: 'select',
        currentValue: 'full-access',
        choices: [{ value: 'full-access', label: 'full-access' }]
      }
    })
    expect(canSetStructuredAgentSessionOption(reported, 'accessMode', 'inherit')).toBe(false)
    expect(canSetStructuredAgentSessionOption(reported, 'accessMode', 'full-access')).toBe(true)
  })

  it('leaves a provider with a restricted mode its choices and no note', () => {
    expect(
      structuredAgentSessionOptionSnapshot(
        createStructuredAgentSessionOptionState('codex', null, MODES)
      )[0]
    ).toMatchObject({ kind: { currentValue: 'inherit' } })
    expect(
      structuredAgentSessionOptionSnapshot(
        createStructuredAgentSessionOptionState('codex', null, MODES)
      )[0]?.note
    ).toBeUndefined()
  })
})

describe('the access a session create asks for', () => {
  it.each([undefined, 'inherit', 'default', 'full-access'])(
    'asks Pi for full access whatever was stored (%s)',
    (requested) => {
      expect(createAccessModeFor('pi', requested)).toBe('full-access')
    }
  )

  it('keeps other agents to a mode they chose, or to none', () => {
    expect(createAccessModeFor('codex', undefined)).toBeUndefined()
    expect(createAccessModeFor('codex', 'inherit')).toBeUndefined()
    expect(createAccessModeFor('codex', 'default')).toBe('default')
  })
})

describe('permission presets in the access option', () => {
  const access = (state: ReturnType<typeof createStructuredAgentSessionOptionState>) =>
    structuredAgentSessionOptionSnapshot(state).find((option) => option.id === 'accessMode')

  it('lists the declared presets in menu order, Full access last', () => {
    const state = createStructuredAgentSessionOptionState('claude', null, MODES, [
      'plan',
      'auto',
      'accept-edits'
    ])
    const kind = access(state)?.kind
    expect(kind?.type === 'select' && kind.choices.map((choice) => choice.value)).toEqual([
      'inherit',
      'default',
      'auto',
      'accept-edits',
      'plan',
      'full-access'
    ])
  })

  it('offers only the two legacy modes when the host declares no presets', () => {
    const kind = access(createStructuredAgentSessionOptionState('claude', null, MODES))?.kind
    expect(kind?.type === 'select' && kind.choices.map((choice) => choice.value)).toEqual([
      'inherit',
      'default',
      'full-access'
    ])
  })

  it('refuses a preset the host did not declare for this agent', () => {
    const state = createStructuredAgentSessionOptionState('codex', null, MODES, [
      'auto',
      'read-only'
    ])
    expect(canSetStructuredAgentSessionOption(state, 'accessMode', 'read-only')).toBe(true)
    expect(canSetStructuredAgentSessionOption(state, 'accessMode', 'plan')).toBe(false)
    expect(commitStructuredAgentSessionOption(state, 'accessMode', 'plan').record.accessMode).toBe(
      undefined
    )
    expect(
      commitStructuredAgentSessionOption(state, 'accessMode', 'read-only').record.accessMode?.value
    ).toBe('read-only')
  })

  it('takes the presets a live options read declares, replacing the capability seed', () => {
    const seeded = createStructuredAgentSessionOptionState('pi', null, ['full-access'])
    const reported = applyStructuredAgentSessionOptions(seeded, CODEX_SESSION_OPTION_CATALOG, {
      models: [],
      current: {},
      accessModeSupport: {
        modes: ['default', 'full-access'],
        presets: ['auto'],
        settable: true
      }
    })
    expect(reported.permissionPresets).toEqual(['auto'])
    expect(canSetStructuredAgentSessionOption(reported, 'accessMode', 'auto')).toBe(true)
  })

  it('keeps a running child to the modes it can switch to, and dims the rest', () => {
    const running = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('claude', null, MODES, ['auto', 'plan']),
      CODEX_SESSION_OPTION_CATALOG,
      {
        models: [],
        current: {},
        accessModeSupport: {
          modes: MODES,
          presets: ['auto', 'plan'],
          settable: false,
          liveModes: ['default', 'auto', 'plan']
        }
      }
    )
    const descriptor = access(running)
    expect(descriptor).toMatchObject({ settable: true, note: 'start-only-modes' })
    const kind = descriptor?.kind
    expect(
      kind?.type === 'select' &&
        kind.choices.filter((choice) => choice.disabled).map((choice) => choice.value)
    ).toEqual(['inherit', 'full-access'])
    expect(canSetStructuredAgentSessionOption(running, 'accessMode', 'plan')).toBe(true)
    expect(canSetStructuredAgentSessionOption(running, 'accessMode', 'full-access')).toBe(false)
  })

  it('locks a running child that cannot switch live, as before', () => {
    const running = applyStructuredAgentSessionOptions(
      createStructuredAgentSessionOptionState('codex', null, MODES),
      CODEX_SESSION_OPTION_CATALOG,
      { models: [], current: {}, accessModeSupport: { modes: MODES, settable: false } }
    )
    expect(access(running)).toMatchObject({
      settable: false,
      disabledReason: 'set-when-session-starts'
    })
    expect(canSetStructuredAgentSessionOption(running, 'accessMode', 'default')).toBe(false)
  })

  it('locks only the non-live modes while the client sees the child run', () => {
    const snapshot = structuredAgentSessionOptionSnapshot(
      createStructuredAgentSessionOptionState('claude', null, MODES, ['auto'])
    )
    const locked = lockStructuredAgentSessionAccessOptions(snapshot, ['default', 'auto'])
    const kind = locked.find((option) => option.id === 'accessMode')?.kind
    expect(locked[0]).toMatchObject({ settable: true, note: 'start-only-modes' })
    expect(
      kind?.type === 'select' &&
        kind.choices.filter((choice) => !choice.disabled).map((choice) => choice.value)
    ).toEqual(['default', 'auto'])
    expect(lockStructuredAgentSessionAccessOptions(snapshot)[0]).toMatchObject({ settable: false })
  })
})

describe('what a create is told for Gentle Shell and presets', () => {
  it('keeps stock Pi at full access and lets Gentle Shell ask for its own mode', () => {
    expect(createAccessModeFor('pi', 'default', 'pi')).toBe('full-access')
    expect(createAccessModeFor('pi', 'default')).toBe('full-access')
    expect(createAccessModeFor('pi', 'default', 'gentle-shell')).toBe('default')
    expect(createAccessModeFor('pi', 'full-access', 'gentle-shell')).toBe('full-access')
    expect(createAccessModeFor('pi', undefined, 'gentle-shell')).toBeUndefined()
    expect(createAccessModeFor('pi', 'inherit', 'gentle-shell')).toBeUndefined()
  })

  it('tells create the closest never-wider legacy value for a preset', () => {
    for (const preset of ['auto', 'accept-edits', 'plan', 'read-only']) {
      expect(createAccessModeFor('pi', preset, 'gentle-shell')).toBe('default')
      expect(createAccessModeFor('codex', preset)).toBe('default')
    }
  })
})
