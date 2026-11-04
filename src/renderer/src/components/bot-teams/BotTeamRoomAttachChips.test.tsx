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
