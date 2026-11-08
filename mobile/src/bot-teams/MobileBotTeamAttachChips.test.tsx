import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamAttachChips } from './MobileBotTeamAttachChips'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ FileText: 'FileText', X: 'X' }))

const REPORT = { path: 'attachments/from-web-impacto.html', name: 'impacto.html' }

function renderChips(props: Parameters<typeof MobileBotTeamAttachChips>[0]): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(MobileBotTeamAttachChips, props))
  })
  return renderer
}

describe('MobileBotTeamAttachChips', () => {
  it('opens a sent file on a tap, as a chat attachment does (pv84 QA)', () => {
    const onOpen = vi.fn()
    const renderer = renderChips({ files: [REPORT], onOpen })
    const chip = renderer.root.find((node) => node.props.accessibilityLabel === 'Open impacto.html')
    act(() => chip.props.onPress())
    expect(onOpen).toHaveBeenCalledWith('attachments/from-web-impacto.html')
  })

  it('keeps a file waiting to be sent as a plain chip', () => {
    const renderer = renderChips({ files: [REPORT], onRemove: vi.fn() })
    const opens = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Open impacto.html'
    )
    expect(opens).toHaveLength(0)
  })
})
