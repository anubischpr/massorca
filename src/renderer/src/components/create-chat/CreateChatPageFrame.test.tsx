/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const { CreateChatPageFrame } = await import('./CreateChatPageFrame')

const mounted: { container: HTMLDivElement; root: Root }[] = []

function mount(layout: 'centered' | 'top'): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() =>
    root.render(
      <CreateChatPageFrame
        heading="What do you want to do?"
        layout={layout}
        below={<b data-below />}
      >
        <i data-composer />
      </CreateChatPageFrame>
    )
  )
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

describe('CreateChatPageFrame top layout', () => {
  it('keeps the heading above true center by a fixed share of the window height, not by the content', () => {
    const heading = mount('top').querySelector('h1')?.parentElement
    // Why: centering on the content would move the composer when approval rows appear below it.
    expect(heading?.className).toMatch(/pt-\[clamp\(/)
    expect(heading?.className).not.toContain('justify-center')
    expect(heading?.className).not.toContain('flex-1')
  })

  it('still centers the empty-state layout, and keeps the list below the composer', () => {
    const container = mount('centered')
    expect(container.querySelector('h1')?.parentElement?.className).toContain('justify-center')
    const top = mount('top')
    const composer = top.querySelector('[data-composer]')
    const below = top.querySelector('[data-below]')
    if (!composer || !below) {
      throw new Error('Frame slots missing')
    }
    expect(composer.compareDocumentPosition(below)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
