/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BotTeamFilePreview } from './BotTeamFilePreview'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const readBotTeamFilePreview = vi.hoisted(() => vi.fn())

vi.mock('./bot-team-file-preview-read', () => ({ readBotTeamFilePreview }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('../native-chat/NativeChatVisualFrame', () => ({
  NativeChatVisualFrame: (props: { document: { html: string } }) => (
    <div data-testid="visual-frame">{props.document.html}</div>
  )
}))

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
  readBotTeamFilePreview.mockReset()
})

async function mount(props: Parameters<typeof BotTeamFilePreview>[0]): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<BotTeamFilePreview {...props} />))
  return container
}

describe('a file of the team as it reads', () => {
  it('shows an image binary file as the picture', async () => {
    readBotTeamFilePreview.mockResolvedValue({
      content: 'AAAA',
      isBinary: true,
      isImage: true,
      mimeType: 'image/png'
    })

    const container = await mount({
      teamId: 't1',
      relativePath: 'attachments/flyer.png',
      kind: 'binary',
      text: null
    })

    expect(readBotTeamFilePreview).toHaveBeenCalledWith('t1', 'attachments/flyer.png')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  it('shows a PDF in an embedded viewer', async () => {
    readBotTeamFilePreview.mockResolvedValue({
      content: 'JVBER',
      isBinary: true,
      isImage: true,
      mimeType: 'application/pdf'
    })

    const container = await mount({
      teamId: 't1',
      relativePath: 'docs/infografia-nexuscare.pdf',
      kind: 'binary',
      text: null
    })

    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'data:application/pdf;base64,JVBER'
    )
  })

  it('says a binary type it cannot show is not previewed here, without an error', async () => {
    readBotTeamFilePreview.mockResolvedValue({ content: 'AA==', isBinary: true, isImage: false })

    const container = await mount({
      teamId: 't1',
      relativePath: 'data/archive.zip',
      kind: 'binary',
      text: null
    })

    expect(container.textContent).toContain("This file type can't be previewed here.")
    expect(container.querySelector('img, iframe')).toBeNull()
  })

  it('shows a text file as its content', async () => {
    const container = await mount({
      teamId: 't1',
      relativePath: 'brand/notes.md',
      kind: 'text',
      text: 'Colors: blue'
    })

    expect(container.querySelector('pre')?.textContent).toBe('Colors: blue')
    expect(readBotTeamFilePreview).not.toHaveBeenCalled()
  })

  it('renders an HTML file as the page it makes, not as its source', async () => {
    const container = await mount({
      teamId: 't1',
      relativePath: 'docs/presentacion/nexuscare-features-deck.html',
      kind: 'text',
      text: '<p>Summer</p>'
    })

    expect(container.querySelector('[data-testid="visual-frame"]')?.textContent).toBe(
      '<p>Summer</p>'
    )
    expect(container.querySelector('pre')).toBeNull()
  })

  it('says a binary file could not load when its preview is refused', async () => {
    readBotTeamFilePreview.mockRejectedValue(new Error('method_not_found'))

    const container = await mount({
      teamId: 't1',
      relativePath: 'attachments/flyer.png',
      kind: 'binary',
      text: null
    })

    expect(container.textContent).toContain('Could not load this file.')
  })
})
