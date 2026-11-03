import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NativeChatChecklistStore } from './native-chat-checklist-store'
import { withNativeChatChecklistUpdate } from '../runtime/rpc/methods/structured-agent-session-send-compatibility'

let directory: string
let clock: number
let store: NativeChatChecklistStore

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'orca-checklist-'))
  clock = 1000
  store = new NativeChatChecklistStore(directory, () => clock++)
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('NativeChatChecklistStore', () => {
  it('records checks, notes and screenshots by item text and survives a reopen', async () => {
    await store.setItem({ sessionId: 's1', title: 'QA', text: ' One ', checked: true })
    await store.setItem({
      sessionId: 's1',
      text: 'one',
      note: 'Falla',
      screenshots: [{ path: '/host/a.png', name: 'a.png' }]
    })
    const state = await new NativeChatChecklistStore(directory).read('s1')
    expect(state.title).toBe('QA')
    expect(state.revision).toBe(2)
    expect(state.marks.one).toMatchObject({
      text: 'one',
      checked: true,
      checkedAt: 1000,
      note: 'Falla',
      screenshots: [{ path: '/host/a.png', name: 'a.png' }],
      revision: 2
    })
    expect(await store.read('other')).toMatchObject({ revision: 0, marks: {} })
  })

  it('clears a note with an empty string', async () => {
    await store.setItem({ sessionId: 's1', text: 'One', note: 'x' })
    const state = await store.setItem({ sessionId: 's1', text: 'One', note: '  ' })
    expect(state.marks.one.note).toBeUndefined()
  })

  it('adds an item for the person and takes it back', async () => {
    const added = await store.setItem({ sessionId: 's1', text: 'Mine', add: true })
    expect(added.marks.mine).toMatchObject({ text: 'Mine', addedAt: 1000 })
    const removed = await store.setItem({ sessionId: 's1', text: 'Mine', remove: true })
    expect(removed.marks.mine.removed).toBe(true)
    // Only an item the person added can be taken back.
    const agentItem = await store.setItem({ sessionId: 's1', text: 'Agent item', remove: true })
    expect(agentItem.marks['agent item'].removed).toBeUndefined()
  })

  it('claims each change once, and the same operation gets the same update', async () => {
    expect(await store.claimUpdate('s1', 'op-0')).toBeNull()
    await store.setItem({ sessionId: 's1', text: 'One', checked: true })
    const first = await store.claimUpdate('s1', 'op-1')
    expect(first).toContain('- [x] One (checked by the person)')
    expect(await store.claimUpdate('s1', 'op-1')).toBe(first)
    expect(await store.claimUpdate('s1', 'op-2')).toBeNull()
    expect((await store.read('s1')).deliveredRevision).toBe(1)
  })

  it('gives a refused send its changes back', async () => {
    await store.setItem({ sessionId: 's1', text: 'One', checked: true })
    await store.claimUpdate('s1', 'op-1')
    await store.releaseUpdate('s1', 'op-1')
    expect((await store.read('s1')).deliveredRevision).toBe(0)
    expect(await store.claimUpdate('s1', 'op-2')).toContain('One')
  })
})

describe('withNativeChatChecklistUpdate', () => {
  const params = (blocks: { type: 'text'; text: string }[]) => ({
    envelope: {
      sessionId: 's1',
      clientOperationId: 'op',
      expectedRuntimeFence: 1,
      payloadFingerprint: 'a'.repeat(64)
    },
    body: { kind: 'message' as const, role: 'user' as const, blocks }
  })

  it('leads the first text block with the update', () => {
    expect(withNativeChatChecklistUpdate(params([{ type: 'text', text: 'Hola' }]), 'U').body.blocks).toEqual([
      { type: 'text', text: 'U\n\nHola' }
    ])
  })
})
