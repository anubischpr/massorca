import { describe, expect, it } from 'vitest'
import { MOBILE_CHAT_CHROME_CONTENT_TOP, mobileChatContentTop } from './mobile-chat-chrome-layout'

describe('mobileChatContentTop', () => {
  it('starts the transcript just beneath the measured controls', () => {
    expect(mobileChatContentTop(150, 47)).toBe(150 + 8)
  })

  it('falls back to the status bar plus the fixed estimate until the controls are measured', () => {
    expect(mobileChatContentTop(0, 47)).toBe(47 + MOBILE_CHAT_CHROME_CONTENT_TOP)
  })
})
