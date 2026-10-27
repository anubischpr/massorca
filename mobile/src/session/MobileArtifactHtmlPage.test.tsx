import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileArtifactHtmlPage } from './MobileArtifactHtmlPage'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: 'Text',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ Code: 'Code', Eye: 'Eye' }))
vi.mock('./MobileNativeChatVisualFrame', () => ({ MobileNativeChatVisualFrame: 'Frame' }))

function labelsOf(mounted: ReactTestRenderer): string[] {
  return mounted.root
    .findAll((node) => node.props.accessibilityRole === 'tab')
    .map((node) => node.props.accessibilityLabel)
}

describe('MobileArtifactHtmlPage', () => {
  let renderer: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
  })

  function mount(renderSource: () => ReactNode = () => 'SOURCE'): ReactTestRenderer {
    const mounted = create(createElement('View'))
    renderer = mounted
    act(() => {
      mounted.update(
        createElement(MobileArtifactHtmlPage, {
          title: 'usage.html',
          html: '<h1>x</h1>',
          renderSource
        })
      )
    })
    return mounted
  }

  function frameOf(mounted: ReactTestRenderer): ReactTestInstance[] {
    return mounted.root.findAll((node) => node.type === 'Frame')
  }

  it('renders the page in the sandboxed frame, fullscreen and titled, by default', () => {
    const mounted = mount()
    expect(labelsOf(mounted)).toEqual(['Preview rendered page', 'View page source'])
    const [frame] = frameOf(mounted)
    expect(frame.props).toMatchObject({
      html: '<h1>x</h1>',
      title: 'usage.html',
      mode: 'fullscreen'
    })
  })

  it('shows the source instead of the frame when the reader flips to Source', () => {
    const mounted = mount()
    const source = mounted.root.find((node) => node.props.accessibilityLabel === 'View page source')
    act(() => source.props.onPress())
    expect(frameOf(mounted)).toHaveLength(0)
    expect(
      mounted.root.findAll((node) => node.type === 'Text').map((node) => node.children)
    ).toEqual(expect.arrayContaining([['Preview'], ['Source']]))
  })

  it('offers a retry after the frame fails, and brings the frame back on retry', () => {
    const mounted = mount()
    act(() => frameOf(mounted)[0].props.onFailed())
    expect(frameOf(mounted)).toHaveLength(0)
    const retry = mounted.root.find(
      (node) => node.props.accessibilityLabel === 'Try the page again'
    )
    act(() => retry.props.onPress())
    expect(frameOf(mounted)).toHaveLength(1)
  })
})
