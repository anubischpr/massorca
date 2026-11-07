/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BotTeamCharacterIcon } from './BotTeamCharacterIcon'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const settings = vi.hoisted(() => ({ animations: true }))
vi.mock('@/store', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ settings: { botTeamCharacterAnimations: settings.animations } })
}))

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  vi.restoreAllMocks()
  settings.animations = true
})

beforeEach(() => {
  stubReducedMotion(false)
  // Why: picks the first move of a character's personality, so the expected class is exact.
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

function stubReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia
}

function mount(element: React.JSX.Element): SVGSVGElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(element))
  const svg = container.querySelector('svg')
  if (!svg) {
    throw new Error('the character renders no svg')
  }
  return svg
}

function hover(svg: SVGSVGElement): void {
  act(() => {
    svg.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
  })
}

function moveClass(svg: SVGSVGElement): string | null {
  return [...svg.classList].find((name) => name.startsWith('bc-move-')) ?? null
}

describe('BotTeamCharacterIcon hover motion', () => {
  it.each([14, 20, 64])('plays a move when the pointer reaches a %dpx character', (size) => {
    const svg = mount(<BotTeamCharacterIcon character="circle" size={size} />)

    expect(moveClass(svg)).toBeNull()
    hover(svg)

    expect(moveClass(svg)).toBe('bc-move-hop')
  })

  it('moves a still character too, such as a chip, a selector row or a list', () => {
    const svg = mount(<BotTeamCharacterIcon character="circle" size={16} still />)
    expect(svg.classList.contains('bc-still')).toBe(true)

    hover(svg)

    expect(moveClass(svg)).toBe('bc-move-hop')
    expect(svg.classList.contains('bc-still')).toBe(false)
  })

  it('keeps a character still under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    const svg = mount(<BotTeamCharacterIcon character="circle" size={20} />)

    hover(svg)

    expect(moveClass(svg)).toBeNull()
  })

  it('keeps a character still when Character animations are turned off', () => {
    settings.animations = false
    const svg = mount(<BotTeamCharacterIcon character="circle" size={20} />)

    hover(svg)

    expect(moveClass(svg)).toBeNull()
  })

  it('moves the character when the row or card that holds it is entered', () => {
    const svg = mount(
      <div data-bot-character-zone>
        <BotTeamCharacterIcon character="circle" size={16} still />
      </div>
    )
    const zone = svg.closest<HTMLElement>('[data-bot-character-zone]')!

    act(() => {
      zone.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    })

    expect(moveClass(svg)).toBe('bc-move-hop')
  })

  it('keeps a character in a hovered row still when Character animations are turned off', () => {
    settings.animations = false
    const svg = mount(
      <div data-bot-character-zone>
        <BotTeamCharacterIcon character="circle" size={16} />
      </div>
    )

    act(() => {
      svg
        .closest<HTMLElement>('[data-bot-character-zone]')!
        .dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    })

    expect(moveClass(svg)).toBeNull()
  })
})
