import { afterEach, describe, expect, it } from 'vitest'
import {
  clearMobileChatSurfaceSnapshot,
  getMobileChatSurfaceSnapshot,
  mobileChatSurfaceKey,
  publishMobileChatSurfaceSnapshot,
  resetMobileChatSurfaceSnapshotsForTest,
  type MobileChatSurfaceSnapshot
} from './mobile-chat-surface-snapshot'

const SNAPSHOT: MobileChatSurfaceSnapshot = {
  messages: [],
  agent: 'claude',
  working: false,
  workingStartedAt: null,
  recordedSource: null
}

describe('mobile chat surface snapshot', () => {
  afterEach(() => {
    resetMobileChatSurfaceSnapshotsForTest()
  })

  it('keys one chat tab per host, worktree and tab', () => {
    expect(mobileChatSurfaceKey('h1', 'w1', 't1')).not.toBe(mobileChatSurfaceKey('h1', 'w1', 't2'))
    expect(mobileChatSurfaceKey('h1', 'w1', 't1')).not.toBe(mobileChatSurfaceKey('h2', 'w1', 't1'))
  })

  it('returns what was published under the key and nothing under another', () => {
    const key = mobileChatSurfaceKey('h1', 'w1', 't1')
    publishMobileChatSurfaceSnapshot(key, SNAPSHOT)
    expect(getMobileChatSurfaceSnapshot(key)).toBe(SNAPSHOT)
    expect(getMobileChatSurfaceSnapshot(mobileChatSurfaceKey('h1', 'w1', 't2'))).toBeNull()
  })

  it('forgets a chat once its session screen clears it', () => {
    const key = mobileChatSurfaceKey('h1', 'w1', 't1')
    publishMobileChatSurfaceSnapshot(key, SNAPSHOT)
    clearMobileChatSurfaceSnapshot(key)
    expect(getMobileChatSurfaceSnapshot(key)).toBeNull()
  })
})
