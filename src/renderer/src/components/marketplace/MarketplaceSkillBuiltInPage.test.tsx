// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILT_IN_SKILL_COMMANDS, type BuiltInSkillCommandId } from './marketplace-skill-built-in'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const actions = vi.hoisted(() => ({ openSettingsPage: vi.fn(), openSettingsTarget: vi.fn() }))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof actions) => unknown) => selector(actions)
}))

const { MarketplaceSkillBuiltInPage } = await import('./MarketplaceSkillBuiltInPage')

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(id: BuiltInSkillCommandId): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <MarketplaceSkillBuiltInPage command={BUILT_IN_SKILL_COMMANDS[id]} onBack={vi.fn()} />
    )
  })
  return container
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
})

describe('MarketplaceSkillBuiltInPage', () => {
  it('says what the command is and that MassOrca builds it in, with nothing to remove', async () => {
    const page = await render('prototype')
    expect(page.querySelector('h2')?.textContent).toBe('Prototype')
    expect(page.textContent).toContain('Make HTML prototypes of an idea')
    expect(page.querySelector('[data-marketplace-status-line]')?.textContent).toBe(
      'Built into MassOrca'
    )
    expect(page.textContent).toContain('Built into this version of MassOrca.')
    expect(page.textContent).not.toContain('Danger zone')
    expect(page.textContent).not.toContain('Remove')
  })

  it('has no setting of its own for the prototype command', async () => {
    const page = await render('prototype')
    expect(page.querySelector('[data-marketplace-skill-settings]')).toBeNull()
  })

  it('opens Orchestration settings from the orchestration command page', async () => {
    const page = await render('orchestration-delegate')
    expect(page.querySelector('h2')?.textContent).toBe('Orca orchestration delegate')
    const open = [...page.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Open'
    )
    await act(async () => open?.click())
    expect(actions.openSettingsTarget).toHaveBeenCalledWith({
      pane: 'orchestration',
      repoId: null
    })
    expect(actions.openSettingsPage).toHaveBeenCalledTimes(1)
  })
})
