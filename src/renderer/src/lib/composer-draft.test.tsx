// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearNativeChatDraftCacheForTests,
  readNativeChatDraftCache
} from '@/components/native-chat/native-chat-draft-cache'
import { composerDraftScopeKey, useComposerDraft } from './composer-draft'

describe('useComposerDraft', () => {
  beforeEach(() => {
    clearNativeChatDraftCacheForTests()
  })

  it('keeps unsent text after the composer unmounts and remounts', () => {
    const first = renderHook(() => useComposerDraft('create'))
    act(() => first.result.current[1]('half a thought'))
    first.unmount()

    expect(renderHook(() => useComposerDraft('create')).result.current[0]).toBe('half a thought')
  })

  it('keeps it in the chat draft store, which saves it across a reload', () => {
    const { result } = renderHook(() => useComposerDraft('room:team-1'))
    act(() => result.current[1]('hello @Atlas'))
    expect(readNativeChatDraftCache(composerDraftScopeKey('room:team-1'))).toBe('hello @Atlas')
  })

  it('keeps each key apart', () => {
    const create = renderHook(() => useComposerDraft('create'))
    act(() => create.result.current[1]('new task'))
    expect(renderHook(() => useComposerDraft('tasks')).result.current[0]).toBe('')
  })

  it('clears the draft on send', () => {
    const { result } = renderHook(() => useComposerDraft('tasks'))
    act(() => result.current[1]('ship it'))
    act(() => result.current[2]())
    expect(result.current[0]).toBe('')
    expect(readNativeChatDraftCache(composerDraftScopeKey('tasks'))).toBe('')
  })

  it('holds text only while mounted for a null key', () => {
    const first = renderHook(() => useComposerDraft(null))
    act(() => first.result.current[1]('typed'))
    expect(first.result.current[0]).toBe('typed')
    first.unmount()
    expect(renderHook(() => useComposerDraft(null)).result.current[0]).toBe('')
  })
})
