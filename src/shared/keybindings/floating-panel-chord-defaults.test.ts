import { describe, expect, it } from 'vitest'
import { KEYBINDING_DEFINITIONS, getKeybindingDefinition } from './definitions'
import { getEffectiveKeybindingsForAction } from './effective'
import { getKeybindingConflictIdentity } from './matching'
import type { KeybindingPlatform } from './types'

const PLATFORMS: readonly KeybindingPlatform[] = ['darwin', 'linux', 'win32']

// Why: compares canonical identities, so Mod+Shift+H on Windows counts as the same chord as Ctrl+Shift+H.
function actionsDefaultingTo(binding: string, platform: KeybindingPlatform): string[] {
  const identity = getKeybindingConflictIdentity(binding, platform)
  return KEYBINDING_DEFINITIONS.filter((definition) =>
    definition.defaultBindings[platform].some(
      (candidate) => getKeybindingConflictIdentity(candidate, platform) === identity
    )
  ).map((definition) => definition.id)
}

describe('floating panel chords', () => {
  it('binds Checklist to Mod+Shift+H and Open a session to Mod+Shift+Y on every platform', () => {
    for (const platform of PLATFORMS) {
      expect(getEffectiveKeybindingsForAction('tab.newChecklist', platform)).toEqual([
        'Mod+Shift+H'
      ])
      expect(getEffectiveKeybindingsForAction('tab.openSession', platform)).toEqual(['Mod+Shift+Y'])
    }
  })

  it('leaves each chord bound to no other default action on any platform', () => {
    for (const platform of PLATFORMS) {
      expect(actionsDefaultingTo('Mod+Shift+H', platform)).toEqual(['tab.newChecklist'])
      expect(actionsDefaultingTo('Mod+Shift+Y', platform)).toEqual(['tab.openSession'])
    }
  })

  it('registers both actions in the Tabs group so Settings lists them', () => {
    expect(getKeybindingDefinition('tab.newChecklist')).toMatchObject({
      group: 'Tabs',
      scope: 'tabs'
    })
    expect(getKeybindingDefinition('tab.openSession')).toMatchObject({
      group: 'Tabs',
      scope: 'tabs'
    })
    expect(getKeybindingDefinition('tab.newChecklist')?.searchKeywords).toContain('checklist')
    expect(getKeybindingDefinition('tab.openSession')?.searchKeywords).toContain('session')
  })
})
