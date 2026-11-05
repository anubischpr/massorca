import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamConferenceRoom } from './MobileBotTeamConferenceRoom'

// Why: each test sets the keyboard and the bottom inset the screen would report before it renders.
const device = vi.hoisted(() => ({ keyboardHeight: 0, bottomInset: 0, os: 'ios' }))

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: device.bottomInset, left: 0 })
}))
vi.mock('../platform/host-os', () => ({ hostOs: () => device.os }))
vi.mock('../platform/keyboard-occlusion', () => ({
  useKeyboardOcclusion: () => device.keyboardHeight
}))
vi.mock('../prototypes/use-open-mobile-prototype-set', () => ({
  useOpenMobilePrototypeSet: () => () => undefined
}))
vi.mock('./use-mobile-bot-team-status', () => ({ useMobileBotTeamStatus: () => () => 'Idle' }))
vi.mock('./MobileBotTeamRoom', () => ({ MobileBotTeamRoom: 'Room' }))
vi.mock('./MobileBotTeamRoomPrototypeLinks', async () => {
  const { createContext } = await import('react')
  return { BotTeamRoomPrototypeOpenContext: createContext(() => undefined) }
})

function renderRoom(): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The wrapper only reads the team and passes the rest on to the mocked room.
    const props = { hostId: 'host', client: {}, team: { id: 'room' }, teams: [] } as never
    renderer = create(createElement(MobileBotTeamConferenceRoom, props))
  })
  return renderer
}

/** The views that pad their content by this much at the bottom. */
function viewsPaddedBy(renderer: ReactTestRenderer, paddingBottom: number) {
  return renderer.root.findAll(
    (node) =>
      node.type === 'View' &&
      Array.isArray(node.props.style) &&
      node.props.style.some(
        (style: { paddingBottom?: number } | undefined) => style?.paddingBottom === paddingBottom
      )
  )
}

describe('MobileBotTeamConferenceRoom', () => {
  it('lifts the room over the iOS keyboard, less the home indicator the screen pads', () => {
    Object.assign(device, { os: 'ios', bottomInset: 34, keyboardHeight: 300 })
    const renderer = renderRoom()
    const lifted = viewsPaddedBy(renderer, 266)
    expect(lifted).toHaveLength(1)
    expect(lifted[0].findAllByType('Room')).toHaveLength(1)
  })

  it('lifts the room by the whole Android keyboard', () => {
    Object.assign(device, { os: 'android', bottomInset: 0, keyboardHeight: 300 })
    const renderer = renderRoom()
    const lifted = viewsPaddedBy(renderer, 300)
    expect(lifted).toHaveLength(1)
    expect(lifted[0].findAllByType('Room')).toHaveLength(1)
  })

  it('keeps the room whole while the keyboard is down', () => {
    Object.assign(device, { os: 'ios', bottomInset: 34, keyboardHeight: 0 })
    const renderer = renderRoom()
    expect(renderer.root.findAllByType('Room')).toHaveLength(1)
    expect(viewsPaddedBy(renderer, 0)).toHaveLength(1)
  })
})
