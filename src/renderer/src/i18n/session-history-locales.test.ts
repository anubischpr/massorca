import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import zh from './locales/zh.json'

const CATALOGS = { es, fr, ja, ko, zh }

describe('session history locales', () => {
  // Why: a key missing from a catalog falls back silently, and an old value keeps the old label.
  it.each(Object.entries(CATALOGS))('%s translates every session history key', (_, catalog) => {
    for (const section of ['AiVaultPanelControls', 'AiVaultSessionRow'] as const) {
      const english = en.auto.components.right.sidebar[section]
      const localized: Record<string, string> = catalog.auto.components.right.sidebar[section]
      expect(Object.keys(localized).sort()).toEqual(Object.keys(english).sort())
    }
  })

  it('names the scope after the worktree, not the workspace, in Spanish', () => {
    const controls = es.auto.components.right.sidebar.AiVaultPanelControls
    expect(controls.workspaceScope).toBe('Este worktree')
    expect(controls.folderScope).toBe('Esta carpeta')
  })
})
