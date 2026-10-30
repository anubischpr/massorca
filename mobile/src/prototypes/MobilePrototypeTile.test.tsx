import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobilePrototypeTile } from './MobilePrototypeTile'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const focus = vi.hoisted(() => ({ focused: true }))
const thumbnail = vi.hoisted(() => vi.fn((): string | null => null))

vi.mock('react-native', () => ({
  StyleSheet: { create: <T,>(styles: T): T => styles },
  View: 'View'
}))
vi.mock('expo-router', () => ({ useIsFocused: () => focus.focused }))
vi.mock('../session/MobileArtifactPagePreview', () => ({ MobileArtifactPagePreview: () => null }))
vi.mock('../session/mobile-artifact-scroll-scope', () => ({
  useArtifactTileNearViewport: () => ({ ref: { current: null }, near: true, onLayout: () => {} })
}))
vi.mock('./use-mobile-prototype-thumbnail', () => ({
  useMobilePrototypeThumbnailHtml: thumbnail
}))

describe('MobilePrototypeTile', () => {
  beforeEach(() => thumbnail.mockClear())

  it.each([
    [true, true],
    [false, false]
  ])('with screen focused %s asks for a live preview: %s', (focused, active) => {
    focus.focused = focused
    act(() => {
      create(
        createElement(MobilePrototypeTile, {
          client: null,
          set: listedSet(),
          direction: undefined,
          style: undefined
        })
      )
    })
    expect(thumbnail).toHaveBeenCalledWith(null, null, active)
  })
})
