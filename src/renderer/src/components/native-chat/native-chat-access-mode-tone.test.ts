import { describe, expect, it } from 'vitest'
import { nativeChatAccessTone } from './native-chat-access-mode-tone'

describe('nativeChatAccessTone', () => {
  it('colours full access as the warning, Auto as the success and every other mode as neutral', () => {
    expect(nativeChatAccessTone('full-access', undefined)).toBe('warning')
    expect(nativeChatAccessTone('auto', undefined)).toBe('success')
    for (const mode of ['default', 'accept-edits', 'plan', 'read-only']) {
      expect(nativeChatAccessTone(mode, undefined)).toBe('neutral')
    }
  })

  it('takes the tone of what inherit resolves to, and stays neutral when that is unknown', () => {
    expect(nativeChatAccessTone('inherit', 'full-access')).toBe('warning')
    expect(nativeChatAccessTone('inherit', 'default')).toBe('neutral')
    expect(nativeChatAccessTone('inherit', undefined)).toBe('neutral')
    expect(nativeChatAccessTone(undefined, undefined)).toBe('neutral')
  })
})
