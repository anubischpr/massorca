/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('./BotAgentIcon', () => ({ BotAgentIcon: () => null }))
vi.mock('./BotTeamCharacterIcon', () => ({ BotTeamCharacterIcon: () => null }))

const { BotTeamRoomMessageBody } = await import('./BotTeamRoomMessageBody')

const MENTIONS = [
  { name: 'Iris', kind: 'bot' as const, agent: 'claude' as const },
  { name: 'Marketing', kind: 'team' as const, character: 'square' as const },
  { name: 'Shop', kind: 'project' as const, logo: { type: 'emoji' as const, emoji: '🛒' } },
  { name: 'Spring', kind: 'project' as const, logo: null }
]

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function render(text: string): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamRoomMessageBody text={text} mentions={MENTIONS} />))
  return container
}

describe('the room message body', () => {
  it('renders bold text, a list and a link as formatted Markdown', () => {
    const container = render(
      '**Lo que no pude verificar:**\n\n- primer punto\n- segundo punto\n\n[docs](https://example.com/docs)'
    )
    expect(container.querySelector('strong')?.textContent).toBe('Lo que no pude verificar:')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    const link = container.querySelector('a')
    expect(link?.textContent).toBe('docs')
    expect(link?.getAttribute('href')).toBe('https://example.com/docs')
  })

  it('renders a known bot mention as a chip that shows the name without the @', () => {
    const container = render('Hola @Iris, revisa esto')
    const chip = container.querySelector('[data-bot-team-mention="Iris"]')
    expect(chip?.textContent).toBe('Iris')
    expect(container.textContent).toContain('Hola Iris, revisa esto')
  })

  it('renders a known team mention as a chip and leaves unknown @words plain', () => {
    const container = render('@Marketing y @Nadie')
    expect(container.querySelector('[data-bot-team-mention="Marketing"]')).not.toBeNull()
    expect(container.querySelector('[data-bot-team-mention="Nadie"]')).toBeNull()
    expect(container.textContent).toContain('@Nadie')
  })

  it('draws a project with its logo, and one without a logo as its name alone', () => {
    const container = render('Revisa @Shop y @Spring')
    const shop = container.querySelector('[data-bot-team-mention="Shop"]')
    expect(shop?.textContent).toBe('🛒Shop')
    const spring = container.querySelector('[data-bot-team-mention="Spring"]')
    expect(spring?.textContent).toBe('Spring')
    expect(spring?.querySelector('svg, img')).toBeNull()
  })

  it('draws a file mention as a chip with its file-type icon, leaving the trailing period', () => {
    const container = render('Usa @site/flyer.html.')
    const chip = container.querySelector('[data-bot-team-mention-file="site/flyer.html"]')
    expect(chip?.textContent).toBe('site/flyer.html')
    expect(chip?.querySelector('svg.lucide-file-code')).not.toBeNull()
    expect(container.textContent).toContain('Usa site/flyer.html.')
  })

  it('shows a file chip’s full path as its tooltip', async () => {
    const container = render('Usa @site/flyer.html')
    const chip = container.querySelector<HTMLElement>('[data-bot-team-mention-file]')
    expect(chip?.getAttribute('data-slot')).toBe('tooltip-trigger')
    chip?.setAttribute('tabindex', '0')
    await act(async () => chip?.focus())
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('site/flyer.html')
  })

  it('does not render raw HTML from a message', () => {
    const container = render('<img src="x" onerror="window.__pwned = true">texto')
    expect(container.querySelector('img[onerror]')).toBeNull()
    expect(container.textContent).toContain('texto')
  })
})
