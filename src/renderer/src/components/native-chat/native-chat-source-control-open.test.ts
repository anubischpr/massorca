import { describe, expect, it, vi } from 'vitest'

const sidebar = vi.hoisted(() => ({
  setRightSidebarTab: vi.fn(),
  setRightSidebarOpen: vi.fn()
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => sidebar }
}))

import { openNativeChatSourceControl } from './native-chat-session-navigation'

describe('openNativeChatSourceControl', () => {
  it('shows the source-control tab of the right sidebar, which /diff opens', async () => {
    expect(await openNativeChatSourceControl()).toBe(true)
    expect(sidebar.setRightSidebarTab).toHaveBeenCalledWith('source-control')
    expect(sidebar.setRightSidebarOpen).toHaveBeenCalledWith(true)
  })
})
