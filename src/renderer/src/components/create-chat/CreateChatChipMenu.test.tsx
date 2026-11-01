/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateChatChipMenu, CreateChatChipMenuGroup } from './CreateChatChipMenu'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))
vi.mock('@/lib/agent-catalog', () => ({ AgentIcon: () => null }))

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function menu(ariaLabel: string, itemLabel: string, onOpenChange?: (open: boolean) => void) {
  return (
    <CreateChatChipMenu
      ariaLabel={ariaLabel}
      label={ariaLabel}
      icon={null}
      onOpenChange={onOpenChange}
      groups={[
        {
          key: 'only',
          value: itemLabel,
          items: [{ value: itemLabel, label: itemLabel }],
          onValueChange: () => {}
        }
      ]}
    />
  )
}

function mountTwo(onAgentOpenChange?: (open: boolean) => void): void {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <CreateChatChipMenuGroup>
        {menu('Agent', 'Claude', onAgentOpenChange)}
        {menu('Location', 'This computer')}
      </CreateChatChipMenuGroup>
    )
  )
}

function press(label: string): void {
  const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  act(() => {
    trigger?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    )
  })
}

const openContents = (): string[] =>
  [...document.querySelectorAll('[role="menu"][data-state="open"]')].map(
    (content) => content.textContent ?? ''
  )

describe('chips of one composer', () => {
  it('open one menu at a time: opening another chip closes the open one in the same step', () => {
    mountTwo()
    press('Agent')
    expect(openContents()).toEqual(['Claude'])
    press('Location')
    expect(openContents()).toEqual(['This computer'])
  })

  it('tells the displaced chip it closed, so it can reset its own steps', () => {
    const onAgentOpenChange = vi.fn()
    mountTwo(onAgentOpenChange)
    press('Agent')
    press('Location')
    expect(onAgentOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('removes the displaced menu without an exit animation, so it cannot resize or flip while it leaves', () => {
    mountTwo()
    press('Agent')
    press('Location')
    const displaced = document.querySelector<HTMLElement>('[role="menu"][data-state="closed"]')
    // Why: a menu mid exit animation keeps being positioned and flips when the layout shifts.
    expect(displaced === null || displaced.style.animation === 'none').toBe(true)
  })
})
