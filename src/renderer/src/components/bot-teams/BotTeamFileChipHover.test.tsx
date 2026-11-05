/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./BotTeamFileHoverPreview', () => ({
  BotTeamFileHoverPreview: () => <iframe title="page" sandbox="" />
}))

const { BotTeamFileHoverCard } = await import('./BotTeamFileChipHover')

const mounted: { container: HTMLDivElement; root: Root }[] = []

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.useRealTimers()
})

function pointer(type: string, target: EventTarget, relatedTarget: EventTarget | null): void {
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerType: 'mouse', relatedTarget })
    )
    vi.advanceTimersByTime(400)
  })
}

describe('BotTeamFileHoverCard', () => {
  it('stays open while the pointer scrolls inside a page preview, and closes once it leaves the card', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted.push({ container, root })
    act(() =>
      root.render(
        <BotTeamFileHoverCard teamId="t1" path="attachments/flyer.html" name="flyer.html">
          <span>flyer.html</span>
        </BotTeamFileHoverCard>
      )
    )

    pointer('pointerover', container.querySelector('span')!, null)
    const frame = document.querySelector('iframe')
    expect(frame).not.toBeNull()

    // Entering the frame looks to the page like leaving the window.
    pointer('pointerout', frame!, null)
    expect(document.querySelector('iframe')).not.toBeNull()

    pointer('pointerover', container, null)
    expect(document.querySelector('iframe')).toBeNull()
  })
})
