/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const readBotTeamFile = vi.hoisted(() => vi.fn())
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/runtime/runtime-bot-team-client', () => ({ readBotTeamFile }))
vi.mock('./bot-team-file-preview-read', () => ({ readBotTeamFilePreview: vi.fn() }))

const { BotTeamFileHoverPreview } = await import('./BotTeamFileHoverPreview')

const mounted: { container: HTMLDivElement; root: Root }[] = []

async function mount(path: string): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () =>
    root.render(
      <BotTeamFileHoverPreview teamId="t1" path={path} name={path.split('/').at(-1) ?? path} />
    )
  )
  return container
}

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  readBotTeamFile.mockReset()
})

describe('BotTeamFileHoverPreview', () => {
  it('renders an HTML attachment as a small page in a script-free frame, not its source', async () => {
    readBotTeamFile.mockResolvedValue({ content: '<h1>Summer sale</h1>', truncated: false })
    const container = await mount('attachments/flyer.html')
    const frame = container.querySelector('iframe')
    expect(frame?.getAttribute('sandbox')).toBe('')
    expect(frame?.getAttribute('srcdoc')).toContain('<h1>Summer sale</h1>')
    expect(frame?.getAttribute('srcdoc')).toContain("default-src 'none'")
    expect(container.querySelector('pre')).toBeNull()
  })

  it('keeps showing the first lines of a text file', async () => {
    readBotTeamFile.mockResolvedValue({ content: 'Goal\nSell the offers', truncated: false })
    const container = await mount('notes.md')
    expect(container.querySelector('pre')?.textContent).toBe('Goal\nSell the offers')
    expect(container.querySelector('iframe')).toBeNull()
  })
})
