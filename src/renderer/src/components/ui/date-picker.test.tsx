/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker, datePickerMonthCells } from './date-picker'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted: { container: HTMLDivElement; root: Root }[] = []
afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(onChange: (value: string) => void): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <DatePicker
        aria-label="Date"
        value="2026-11-04"
        today="2026-11-03"
        min="2026-11-03"
        locale="en-US"
        onChange={onChange}
      />
    )
  )
  return container
}

const day = (name: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="grid"] button')].find(
    (entry) => entry.textContent === name
  )

describe('DatePicker', () => {
  it('starts a month on its weekday, weeks beginning on Sunday', () => {
    // November 2026 begins on a Sunday; December on a Tuesday.
    expect(datePickerMonthCells(2026, 10).slice(0, 2)).toEqual([1, 2])
    expect(datePickerMonthCells(2026, 11).slice(0, 3)).toEqual([null, null, 1])
    expect(datePickerMonthCells(2026, 10)).toHaveLength(30)
  })

  it('shows the picked day on its button and opens a month with today, the pick and past days marked', () => {
    const container = mount(() => {})
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Date"]')
    expect(trigger?.textContent).toBe('Wed, Nov 4')
    act(() => trigger?.click())
    expect(document.body.textContent).toContain('November 2026')
    expect(day('3')?.getAttribute('aria-current')).toBe('date')
    expect(day('4')?.getAttribute('aria-pressed')).toBe('true')
    expect(day('2')?.disabled).toBe(true)
  })

  it('picks a day in another month and closes', () => {
    const onChange = vi.fn()
    const container = mount(onChange)
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Date"]')?.click())
    act(() => document.querySelector<HTMLButtonElement>('[aria-label="Next month"]')?.click())
    expect(document.body.textContent).toContain('December 2026')
    act(() => day('15')?.click())
    expect(onChange).toHaveBeenCalledWith('2026-12-15')
    expect(document.querySelector('[role="grid"]')).toBeNull()
  })
})
