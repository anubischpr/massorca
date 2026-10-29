import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentChildRowModel } from '../../../src/shared/agent-child-row-model'
import { emptySeenBackgroundWork } from './mobile-seen-background-work'
import {
  MAX_SEEN_BACKGROUND_CHATS,
  readSeenBackgroundWork,
  resetSeenBackgroundWorkStoreForTests,
  writeSeenBackgroundWork
} from './mobile-seen-background-work-store'

function row(id: string): AgentChildRowModel {
  return {
    id,
    providerId: id,
    kind: 'agent',
    displayState: 'idle',
    name: `agent ${id}`,
    detail: null,
    firstObservedAt: 1_000,
    recencyAt: 1_000,
    canStop: false,
    settled: true,
    owned: []
  }
}

describe('seen background work store', () => {
  beforeEach(() => {
    resetSeenBackgroundWorkStoreForTests()
  })

  it('reads an empty fold for a chat it has not kept', () => {
    expect(readSeenBackgroundWork('chat-a')).toEqual(emptySeenBackgroundWork('chat-a'))
  })

  it('reads back what was written for a chat, so a remount keeps its finished rows', () => {
    const seen = { ...emptySeenBackgroundWork('chat-a'), finished: [row('done')] }
    writeSeenBackgroundWork(seen)
    expect(readSeenBackgroundWork('chat-a')).toBe(seen)
  })

  it('keeps each chat apart', () => {
    writeSeenBackgroundWork({ ...emptySeenBackgroundWork('chat-a'), finished: [row('a')] })
    expect(readSeenBackgroundWork('chat-b').finished).toEqual([])
  })

  it('drops the least recently used chat once the bound is passed', () => {
    for (let index = 0; index < MAX_SEEN_BACKGROUND_CHATS; index += 1) {
      writeSeenBackgroundWork({
        ...emptySeenBackgroundWork(`chat-${index}`),
        finished: [row(`r${index}`)]
      })
    }
    // Reading chat-0 makes it the most recently used, so chat-1 is the one dropped next.
    readSeenBackgroundWork('chat-0')
    writeSeenBackgroundWork(emptySeenBackgroundWork('chat-new'))
    expect(readSeenBackgroundWork('chat-0').finished.map((item) => item.id)).toEqual(['r0'])
    expect(readSeenBackgroundWork('chat-1').finished).toEqual([])
  })
})
