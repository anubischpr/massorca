/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BotTeamRoomAttachChips } from './BotTeamRoomAttachChips'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(props: Parameters<typeof BotTeamRoomAttachChips>[0]) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamRoomAttachChips {...props} />))
  return container
}

describe('the files a room message names', () => {
  it('opens the file in the team Files view when its chip is clicked', () => {
    const onOpen = vi.fn()
    const container = mount({ files: [FLYER], onOpen })

    act(() => container.querySelector<HTMLButtonElement>('button')!.click())

    expect(onOpen).toHaveBeenCalledWith('attachments/flyer.png')
  })

  it('keeps the chip plain when the room has no Files view to open', () => {
    const container = mount({ files: [FLYER] })

    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).toContain('flyer.png')
  })
})

describe('the file-type icon before each attached name', () => {
  function chipOf(container: HTMLDivElement): Element {
    return container.querySelector('li')!.firstElementChild!
  }

  it.each([
    ['site/landing.html', 'lucide-file-code'],
    ['notes/plan.md', 'lucide-file-text'],
    ['attachments/flyer.png', 'lucide-file-image'],
    ['reports/summary.pdf', 'lucide-file-text'],
    ['src/app.ts', 'lucide-file-code'],
    ['data/archive.xyz', 'lucide-file']
  ])('draws the icon of %s before its name in a chip that opens it', (path, iconClass) => {
    const name = path.split('/').pop() ?? path
    const container = mount({ files: [{ path, name }], onOpen: vi.fn() })

    const icon = chipOf(container).firstElementChild
    expect(icon?.tagName.toLowerCase()).toBe('svg')
    expect(icon?.classList.contains(iconClass)).toBe(true)
    expect(icon?.nextElementSibling?.textContent).toBe(name)
  })

  it('draws the icon in a chip that only names its file', () => {
    const container = mount({ files: [FLYER] })

    expect(chipOf(container).firstElementChild?.classList.contains('lucide-file-image')).toBe(true)
  })

  it('hides the decorative icon from assistive technology', () => {
    const container = mount({ files: [FLYER], onOpen: vi.fn() })

    expect(chipOf(container).firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})
