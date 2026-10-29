import { describe, expect, it, vi } from 'vitest'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { SettingsUpdate } from '../../../shared/rpc-contract/client-settings-params'
import { updateSettings, type SettingsMutationOperations } from './settings-update'

function makeOperations(): SettingsMutationOperations {
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields updateSettings reads for this setting.
    state: { settings: {}, repos: [] } as unknown as PersistedState,
    bumpLocalWorktreeScanGeneration: vi.fn(),
    removeRetainedBlob: vi.fn(),
    scheduleSave: vi.fn(),
    notifySettingsChanged: vi.fn()
  }
}

describe('updateSettings prototypeCount', () => {
  it('stores a valid setting as written', () => {
    expect(
      updateSettings(makeOperations(), { prototypeCount: { mode: 'ask', count: 3 } }).prototypeCount
    ).toEqual({ mode: 'ask', count: 3 })
  })

  it('repairs each field of a hand-built write instead of storing it', () => {
    const operations = makeOperations()
    expect(
      updateSettings(operations, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a hand-built client can send any JSON; the boundary must repair it.
        prototypeCount: { mode: 'sometimes', count: 99 } as unknown as never
      }).prototypeCount
    ).toEqual({ mode: 'always', count: 4 })
    expect(
      updateSettings(operations, {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a hand-built client can send any JSON; the boundary must repair it.
        prototypeCount: 'ask' as unknown as never
      }).prototypeCount
    ).toEqual({ mode: 'always', count: 2 })
  })
})

describe('the settings.update schema', () => {
  it('accepts prototypeCount and repairs it the same way', () => {
    expect(SettingsUpdate.parse({ prototypeCount: { mode: 'ask', count: 3 } })).toEqual({
      prototypeCount: { mode: 'ask', count: 3 }
    })
    expect(SettingsUpdate.parse({ prototypeCount: { mode: 'x', count: 0 } })).toEqual({
      prototypeCount: { mode: 'always', count: 1 }
    })
  })

  it('still accepts an update without it, as older clients send', () => {
    expect(SettingsUpdate.parse({})).toEqual({})
  })
})
