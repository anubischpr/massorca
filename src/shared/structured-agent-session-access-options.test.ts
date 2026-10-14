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
})
