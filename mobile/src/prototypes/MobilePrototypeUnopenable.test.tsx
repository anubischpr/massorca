import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobilePrototypeUnopenable } from './MobilePrototypeUnopenable'

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View'
}))

vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))

vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft' }))

// The approved line, as the frame shows it; the frame module itself loads the WebView, so it is not loaded here.
vi.mock('./MobilePrototypeFrame', () => ({
  PROTOTYPE_UNREADABLE_LINE: "Couldn't open this prototype"
}))

/** The host elements of one type; the test doubles for Text and Pressable are host strings. */
function hosts(renderer: ReactTestRenderer, type: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => node.type === type)
}

describe('MobilePrototypeUnopenable', () => {
  it('says the prototype cannot be opened, and goes back when asked', () => {
    const onBack = vi.fn()
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(createElement(MobilePrototypeUnopenable, { onBack }))
    })
    if (renderer === undefined) {
      throw new Error('the unopenable state did not mount')
    }
    const mounted: ReactTestRenderer = renderer
    // The header's title is empty here, so only the line itself has text.
    const shown = hosts(mounted, 'Text')
      .map((text) => String(text.props.children))
      .filter((text) => text !== '')
    expect(shown).toEqual(["Couldn't open this prototype"])
    act(() => {
      hosts(mounted, 'Pressable')[0]?.props.onPress()
    })
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
