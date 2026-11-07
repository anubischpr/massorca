import { describe, expect, it, vi } from 'vitest'
import { customRows } from './MarketplaceCatalogCustomRows'
import type { CatalogBuildInputs } from './MarketplaceCatalogRows'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

function inputsFor(custom: CatalogBuildInputs['custom'], hostLabel: string): CatalogBuildInputs {
  return {
    hostLabel,
    badgeFor: () => 'not-installed',
    cli: { gh: 'not-installed' },
    agents: [],
    skills: { kind: 'ready', value: [] },
    custom,
    installingCustomIds: new Set(),
    integrations: {
      gitlab: 'not-connected',
      bitbucket: 'not-connected',
      'azure-devops': 'not-connected',
      gitea: 'not-connected',
      linear: 'not-connected',
      jira: 'not-connected'
    }
  }
}

describe('customRows on a picked host', () => {
  it("says the picked host has no custom items yet, and lists none of this computer's", () => {
    const rows = customRows(inputsFor({ kind: 'unavailable' }, 'srv2056164'), 'tool', 'tools')
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'Custom tools',
        status: { kind: 'pending', label: 'Not available on srv2056164 yet' },
        owned: false,
        customId: null
      })
    ])
  })

  it('names the custom agents row for the agents section on the picked host', () => {
    const rows = customRows(inputsFor({ kind: 'unavailable' }, 'WSL: Ubuntu'), 'agent', 'agents')
    expect(rows).toEqual([
      expect.objectContaining({
        name: 'Custom agents',
        section: 'agents',
        status: { kind: 'pending', label: 'Not available on WSL: Ubuntu yet' }
      })
    ])
  })
})
