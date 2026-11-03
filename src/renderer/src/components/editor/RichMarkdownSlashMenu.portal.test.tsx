/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RichMarkdownSlashMenu } from './RichMarkdownSlashMenu'
import type { SlashMenuState } from './rich-markdown-slash-commands'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const MENU_HEIGHT = 200
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
const originalInnerHeight = window.innerHeight

// Why: happy-dom has no layout, so the rendered menu reports the height a real one would take.
function stubMenuHeight(): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('rich-markdown-slash-menu') ? MENU_HEIGHT : 0
    }
  })
}

function anchorAt(top: number): HTMLDivElement {
  const anchor = document.createElement('div')
  anchor.getBoundingClientRect = () =>
    ({
      left: 40,
      top,
      right: 340,
      bottom: top + 400,
      width: 300,
      height: 400,
      x: 40,
      y: top
    }) as DOMRect
  return anchor
}

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function renderMenu(
  anchor: HTMLDivElement,
  slashMenu: SlashMenuState
): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  container.className = 'overflow-hidden'
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <RichMarkdownSlashMenu
        editor={null}
        slashMenu={slashMenu}
        filteredCommands={[]}
        selectedIndex={0}
        onImagePick={() => {}}
        onEmojiPick={() => {}}
        portalToDocument
        anchorElement={anchor}
      />
    )
  )
  return container
}

const menuOf = (): HTMLElement => {
  const menu = document.querySelector<HTMLElement>('.rich-markdown-slash-menu')
  if (!menu) {
    throw new Error('Slash menu missing')
  }
  return menu
}

beforeEach(() => {
  document.body.innerHTML = ''
  stubMenuHeight()
})

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
  }
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
})

describe('RichMarkdownSlashMenu when portaled', () => {
  it('renders outside the editor box, so no clipping ancestor can cut it', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const host = await renderMenu(anchorAt(100), { query: '', from: 1, to: 2, left: 30, top: 40 })

    expect(menuOf().parentElement).toBe(document.body)
    expect(host.contains(menuOf())).toBe(false)
  })

  it('places the menu under the caret when there is room below', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    await renderMenu(anchorAt(100), { query: '', from: 1, to: 2, left: 30, top: 40 })

    // Why: the caret bottom is anchor.top + top - 8 and the menu sits 8px below it.
    expect(menuOf().style.top).toBe('140px')
    expect(menuOf().style.left).toBe('70px')
  })

  it('flips above the caret when the menu would run off the bottom of the window', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    await renderMenu(anchorAt(500), { query: '', from: 1, to: 2, left: 30, top: 40 })

    // Why: caret top is 532 - 24 = 508; the menu ends 8px above it, so it starts at 300.
    expect(menuOf().style.top).toBe('300px')
    expect(menuOf().style.position).toBe('fixed')
  })
})
