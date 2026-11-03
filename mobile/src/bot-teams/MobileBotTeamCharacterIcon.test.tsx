import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileBotTeamCharacterIcon } from './MobileBotTeamCharacterIcon'

const motion = vi.hoisted(() => ({ enabled: true, reduced: false as boolean | null }))
const reanimated = vi.hoisted(() => ({ cancel: vi.fn() }))

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} })
  },
  View: 'View'
}))
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  Easing: { linear: (value: number) => value },
  cancelAnimation: reanimated.cancel,
  useAnimatedStyle: (style: () => object) => style(),
  useSharedValue: (value: number) => ({ value }),
  withRepeat: (value: number) => ({ repeat: value }),
  withSequence: (...values: number[]) => values[0],
  withTiming: (value: number) => value
}))
vi.mock('react-native-svg', () => ({ default: 'Svg', G: 'G', Path: 'Path' }))
vi.mock('./MobileBotCharacterEffect', () => ({ MobileBotCharacterEffect: 'Effect' }))
vi.mock('./mobile-bot-character-preference', () => ({
  useBotCharacterAnimations: () => motion.enabled
}))
vi.mock('../onboarding/use-reduced-motion', () => ({
  useReducedMotionEnabled: () => motion.reduced
}))

function effects(props: {
  working?: boolean
  unreachable?: boolean
  still?: boolean
  size?: number
}) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      createElement(MobileBotTeamCharacterIcon, { character: 'circle', size: 64, ...props })
    )
  })
  const found = renderer.root.findAll((node) => node.type === ('Effect' as never))
  const summary = found.map((node) => `${node.props.effect}:${node.props.layer}`)
  act(() => renderer.unmount())
  return summary
}

describe('MobileBotTeamCharacterIcon', () => {
  beforeEach(() => {
    motion.enabled = true
    motion.reduced = false
  })

  it('draws the working effect behind and in front of the body', () => {
    expect(effects({ working: true })).toEqual(['rainbow:back', 'rainbow:front'])
  })

  it('shows no effect while the team is not working', () => {
    expect(effects({})).toEqual([])
  })

  it('shows neither working nor stopped when the host cannot be reached', () => {
    expect(effects({ working: true, unreachable: true })).toEqual([])
  })

  it('keeps a still aura when animations are off or reduced motion is on', () => {
    motion.enabled = false
    expect(effects({ working: true })).toEqual(['aura:back'])
    motion.enabled = true
    motion.reduced = true
    expect(effects({ working: true })).toEqual(['aura:back'])
  })

  it('falls back to the aura at a size too small for orbits', () => {
    expect(effects({ working: true, size: 20 })).toEqual(['aura:back'])
  })

  it('stops the lean repeat when a leaning character leaves the screen', () => {
    let renderer!: ReactTestRenderer
    act(() => {
      renderer = create(
        createElement(MobileBotTeamCharacterIcon, { character: 'circle', size: 64, working: true })
      )
    })
    reanimated.cancel.mockClear()
    act(() => renderer.unmount())
    // The lean repeats from its first 8 degree tilt; the orbit clock repeats 1, so 8 is the lean.
    const leanStopped = reanimated.cancel.mock.calls.some(([shared]) => shared?.value?.repeat === 8)
    expect(leanStopped).toBe(true)
  })
})
