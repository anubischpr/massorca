import { describe, expect, it } from 'vitest'
import { RuntimeRpcCallError } from '../../runtime/runtime-rpc-result'
import { structuredChatReleaseFailureNotice } from './structured-chat-release-failure-notice'

const FIXED = 'Could not open this chat in the terminal. The chat was left open.'

function refusedRelease(code: string, details: Record<string, string>): RuntimeRpcCallError {
  return new RuntimeRpcCallError({
    id: 'rpc-release-1',
    ok: false,
    error: { code: 'runtime_error', message: code, data: { refusal: { code, details } } },
    _meta: { runtimeId: null }
  })
}

describe('structuredChatReleaseFailureNotice', () => {
  it('keeps the fixed sentence when the release failed without a host refusal', () => {
    expect(structuredChatReleaseFailureNotice(new Error('connection reset'))).toBe(FIXED)
  })

  it('adds the reason the host refused the release, after the fixed sentence', () => {
    const notice = structuredChatReleaseFailureNotice(
      refusedRelease('agent_session_ownership_unknown', {
        reason: 'previousExitUnverifiable',
        ownerVerdict: 'unverifiable'
      })
    )
    expect(notice.startsWith(FIXED)).toBe(true)
    expect(notice.length).toBeGreaterThan(FIXED.length)
  })

  it('still opens with the fixed sentence when the refusal names no reason', () => {
    const notice = structuredChatReleaseFailureNotice(
      refusedRelease('agent_session_ownership_unknown', {})
    )
    expect(notice.startsWith(FIXED)).toBe(true)
  })
})
