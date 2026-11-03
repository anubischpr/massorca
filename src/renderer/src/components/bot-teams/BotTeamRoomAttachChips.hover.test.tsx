/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BotTeamRoomAttachChips } from './BotTeamRoomAttachChips'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('./BotTeamFileHoverPreview', () => ({ BotTeamFileHoverPreview: () => null }))

const FLYER = { path: 'attachments/flyer.png', name: 'flyer.png' }

const mounted: { container: HTMLDivElement; root: Root }[] = []

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount())
    container.remove()
  }
})

function mount(props: Parameters<typeof BotTeamRoomAttachChips>[0]): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ container, root })
  act(() => root.render(<BotTeamRoomAttachChips {...props} />))
  return container
}

describe('a room chip that previews its file on hover', () => {
  it('still opens the file on click when the room names its team', () => {
    const onOpen = vi.fn()
    const container = mount({ files: [FLYER], onOpen, teamId: 't1' })

    act(() => container.querySelector<HTMLButtonElement>('button')!.click())

    expect(onOpen).toHaveBeenCalledWith('attachments/flyer.png')
  })

  it('leaves the native path tooltip off, since the hover card names the file', () => {
    const container = mount({ files: [FLYER], onOpen: vi.fn(), teamId: 't1' })

    expect(container.querySelector('button')?.getAttribute('title')).toBeNull()
  })
})
