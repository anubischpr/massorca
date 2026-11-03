/**
 * @vitest-environment happy-dom
 */
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => values?.[name] ?? '')
}))

const { BotTeamRoutineTimePicker } = await import('./BotTeamRoutineTimePicker')

globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
Element.prototype.scrollIntoView ??= () => {}

function Harness({ start, onChange }: { start: string; onChange: (time: string) => void }) {
  const [time, setTime] = useState(start)
  return (
    <BotTeamRoutineTimePicker
      value={time}
      onChange={(next) => {
        setTime(next)
        onChange(next)
      }}
    />
  )
}

const roots: (() => void)[] = []
afterEach(() => {
  for (const unmount of roots.splice(0)) {
    unmount()
  }
  document.body.innerHTML = ''
})

function mount(start: string) {
  const onChange = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(<Harness start={start} onChange={onChange} />))
  roots.push(() => act(() => root.unmount()))
  const button = (name: string): HTMLButtonElement | undefined =>
    [...document.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === name)
  return { onChange, button }
}

describe('routine time picker', () => {
  it('picks a quick time in one click and marks it', () => {
    const { onChange, button } = mount('09:00')
    expect(button('Morning 09:00')?.getAttribute('aria-pressed')).toBe('true')
    act(() => button('Evening 19:00')?.click())
    expect(onChange).toHaveBeenCalledWith('19:00')
    expect(button('Evening 19:00')?.getAttribute('aria-pressed')).toBe('true')
    expect(button('Other time')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('lists quarter hours under Other time, checks the chosen one and takes a typed time', async () => {
    const { onChange, button } = mount('10:30')
    // A time that is not a quick one stands on the dashed chip.
    const other = button('10:30')
    expect(other?.getAttribute('aria-pressed')).toBe('true')
    await act(async () => {
      other?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      other?.click()
    })
    const items = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[cmdk-item]')]
    expect(items()).toHaveLength(96)
    const checked = items().find((item) => item.querySelector('svg'))
    expect(checked?.textContent).toBe('10:30')

    const input = document.querySelector<HTMLInputElement>('[cmdk-input]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        '7:05 pm'
      )
      input?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(items().map((item) => item.textContent)).toEqual(['19:05'])
    await act(async () => items()[0]?.click())
    expect(onChange).toHaveBeenCalledWith('19:05')
    expect(button('19:05')).toBeDefined()
  })
})
