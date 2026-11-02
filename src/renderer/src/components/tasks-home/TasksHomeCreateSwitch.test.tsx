/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const { TasksHomeCreateSwitch } = await import('./TasksHomeCreateSwitch')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(
  mode: 'workspaces' | 'bot-team',
  onModeChange: (mode: 'workspaces' | 'bot-team') => void = () => {}
): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<TasksHomeCreateSwitch mode={mode} onModeChange={onModeChange} />))
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('TasksHomeCreateSwitch', () => {
  it('is a radio group named Create with WorkSpaces and Bot Team, in that order', () => {
    const container = mount('workspaces')
    expect(container.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Create'
    )
    const radios = [...container.querySelectorAll('[role="radio"]')]
    expect(radios.map((radio) => radio.textContent)).toEqual(['WorkSpaces', 'Bot Team'])
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  })

  it('checks Bot Team when it is the mode, and reports a pick', () => {
    const onModeChange = vi.fn()
    const container = mount('bot-team', onModeChange)
    const radios = [...container.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    act(() => radios[0].click())
    expect(onModeChange).toHaveBeenCalledWith('workspaces')
  })
})
