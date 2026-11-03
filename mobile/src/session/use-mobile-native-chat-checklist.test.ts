import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NativeChatChecklistPersonState } from '../../../src/shared/native-chat-checklist'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import type { RpcClient } from '../transport/rpc-client'
import {
  useMobileNativeChatChecklist,
  type MobileNativeChatChecklistArgs,
  type MobileNativeChatChecklistView
} from './use-mobile-native-chat-checklist'

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  setItem: vi.fn(),
  upload: vi.fn(async () => []),
  pickImage: vi.fn(async () => null)
}))

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 }
}))
vi.mock('../platform/media-picker', () => ({
  useMediaPicker: () => ({ pickImage: mocks.pickImage, pickImages: vi.fn() })
}))
vi.mock('./mobile-native-chat-checklist-rpc', () => ({
  agentSessionChecklistRead: {
    request: (...args: unknown[]) => mocks.read(...args),
    interpret: (response: { ok: boolean; result?: unknown }) =>
      response.ok ? response.result : null
  },
  agentSessionChecklistSetItem: {
    request: (...args: unknown[]) => mocks.setItem(...args),
    interpret: (response: { ok: boolean; result?: unknown }) =>
      response.ok ? response.result : null
  }
}))
vi.mock('./mobile-native-chat-image-attachment', () => ({
  uploadMobileNativeChatImages: mocks.upload
}))
vi.mock('./mobile-worktree-connection-id', () => ({
  readMobileWorktreeConnectionId: vi.fn(async () => null)
}))

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the RPC module is mocked; the client is only passed through.
const CLIENT = {} as RpcClient
const SOURCE = { client: CLIENT, sessionId: 'session-1' }

const REPLY: NativeChatMessage = {
  id: 'reply-1',
  role: 'assistant',
  blocks: [
    {
      type: 'text',
      text: '```orca-checklist\ntitle: QA preview\n- [ ] Write tests\n- [x] Build\n```'
    }
  ],
  timestamp: 1000,
  source: 'transcript'
}

const EMPTY_STATE: NativeChatChecklistPersonState = {
  revision: 0,
  deliveredRevision: 0,
  title: null,
  marks: {}
}

// The hook's reads resolve across a few microtask turns; drain them inside act so state settles.
async function flush(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 5; turn += 1) {
      await Promise.resolve()
    }
  })
}

function mountChecklist(initial: MobileNativeChatChecklistArgs): {
  view: () => MobileNativeChatChecklistView
  rerender: (next: MobileNativeChatChecklistArgs) => void
  renderer: ReactTestRenderer
} {
  const latest: { view: MobileNativeChatChecklistView | null } = { view: null }
  function Probe(props: MobileNativeChatChecklistArgs) {
    latest.view = useMobileNativeChatChecklist(props)
    return null
  }
  const renderer = create(createElement('View'))
  act(() => {
    renderer.update(createElement(Probe, initial))
  })
  return {
    view: () => {
      if (latest.view === null) {
        throw new Error('the hook has not rendered')
      }
      return latest.view
    },
    rerender: (next) => {
      act(() => {
        renderer.update(createElement(Probe, next))
      })
    },
    renderer
  }
}

describe('useMobileNativeChatChecklist', () => {
  let mounted: ReactTestRenderer | null = null

  afterEach(() => {
    act(() => mounted?.unmount())
    mounted = null
    mocks.read.mockReset()
    mocks.setItem.mockReset()
  })

  it('reads the person’s marks when it opens and applies them to the items', async () => {
    mocks.read.mockResolvedValue({
      ok: true,
      result: {
        ok: true,
        state: {
          revision: 2,
          deliveredRevision: 0,
          title: null,
          marks: {
            'write tests': { text: 'Write tests', checked: true, checkedAt: 2000, revision: 2 }
          }
        }
      }
    })
    const harness = mountChecklist({ source: SOURCE, messages: [REPLY], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    expect(mocks.read).toHaveBeenCalledWith(CLIENT, { sessionId: 'session-1' })
    const first = harness.view().checklist?.items[0]
    expect(first?.checked).toBe(true)
    expect(first?.by).toBe('person')
    expect(harness.view().readOnly).toBe(false)
  })

  it('saves a tick through setItem with the list title, and applies the state the host answers', async () => {
    mocks.read.mockResolvedValue({ ok: true, result: { ok: true, state: EMPTY_STATE } })
    mocks.setItem.mockResolvedValue({
      ok: true,
      result: {
        ok: true,
        state: {
          revision: 3,
          deliveredRevision: 0,
          title: 'QA preview',
          marks: {
            'write tests': { text: 'Write tests', checked: true, checkedAt: 5000, revision: 3 }
          }
        }
      }
    })
    const harness = mountChecklist({ source: SOURCE, messages: [REPLY], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    const item = harness.view().checklist?.items.find((candidate) => candidate.text === 'Write tests')
    expect(item).toBeDefined()
    await act(async () => {
      if (item) {
        await harness.view().toggleItem(item)
      }
    })
    expect(mocks.setItem).toHaveBeenCalledWith(CLIENT, {
      sessionId: 'session-1',
      title: 'QA preview',
      text: 'Write tests',
      checked: true
    })
    expect(harness.view().checklist?.items.find((candidate) => candidate.text === 'Write tests')?.checked).toBe(true)
  })

  it('turns read-only when the host does not offer the checklist methods', async () => {
    mocks.read.mockResolvedValue({
      ok: false,
      error: { code: 'method_not_found', message: 'Unknown method' }
    })
    const harness = mountChecklist({ source: SOURCE, messages: [REPLY], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    expect(harness.view().readOnly).toBe(true)
    expect(harness.view().checklist?.items).toHaveLength(2)
  })

  it('reads again when the chat’s messages change, so a sent update shows as delivered', async () => {
    mocks.read.mockResolvedValue({ ok: true, result: { ok: true, state: EMPTY_STATE } })
    const harness = mountChecklist({ source: SOURCE, messages: [REPLY], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    const reads = mocks.read.mock.calls.length
    harness.rerender({
      source: SOURCE,
      messages: [
        REPLY,
        { id: 'user-2', role: 'user', blocks: [{ type: 'text', text: 'Checked' }], timestamp: 2000, source: 'transcript' }
      ],
      worktreeId: 'wt-1'
    })
    await flush()
    expect(mocks.read.mock.calls.length).toBeGreaterThan(reads)
  })

  it('reads the marks of a chat with no agent checklist, since the person can add items to it', async () => {
    mocks.read.mockResolvedValue({ ok: true, result: { ok: true, state: EMPTY_STATE } })
    const harness = mountChecklist({ source: SOURCE, messages: [], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    expect(mocks.read).toHaveBeenCalledWith(CLIENT, { sessionId: 'session-1' })
  })

  it('adds an item the person wrote through setItem with add: true, and lists it after the agent’s', async () => {
    mocks.read.mockResolvedValue({ ok: true, result: { ok: true, state: EMPTY_STATE } })
    mocks.setItem.mockResolvedValue({
      ok: true,
      result: {
        ok: true,
        state: {
          revision: 1,
          deliveredRevision: 0,
          title: null,
          marks: {
            'check the banner': {
              text: 'Check the banner',
              addedAt: 3000,
              revision: 1
            }
          }
        }
      }
    })
    const harness = mountChecklist({ source: SOURCE, messages: [REPLY], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    await act(async () => {
      await harness.view().addItem('Check the banner')
    })
    expect(mocks.setItem).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({ sessionId: 'session-1', text: 'Check the banner', add: true })
    )
    const items = harness.view().checklist?.items ?? []
    expect(items.map((item) => item.text)).toEqual(['Write tests', 'Build', 'Check the banner'])
    expect(items[2]).toMatchObject({ source: 'person', addedAt: 3000 })
  })

  it('takes back an item the person added through setItem with remove: true, and closes its sheet', async () => {
    mocks.read.mockResolvedValue({
      ok: true,
      result: {
        ok: true,
        state: {
          revision: 1,
          deliveredRevision: 0,
          title: null,
          marks: {
            'check the banner': { text: 'Check the banner', addedAt: 3000, revision: 1 }
          }
        }
      }
    })
    mocks.setItem.mockResolvedValue({
      ok: true,
      result: {
        ok: true,
        state: {
          revision: 2,
          deliveredRevision: 0,
          title: null,
          marks: {
            'check the banner': { text: 'Check the banner', addedAt: 3000, removed: true, revision: 2 }
          }
        }
      }
    })
    const harness = mountChecklist({ source: SOURCE, messages: [], worktreeId: 'wt-1' })
    mounted = harness.renderer
    await flush()
    const item = harness.view().checklist?.items[0]
    expect(item?.text).toBe('Check the banner')
    await act(async () => {
      harness.view().openItem('check the banner')
    })
    await act(async () => {
      await harness.view().removeItem('check the banner')
    })
    expect(mocks.setItem).toHaveBeenCalledWith(
      CLIENT,
      expect.objectContaining({ text: 'Check the banner', remove: true })
    )
    expect(harness.view().checklist).toBeNull()
    expect(harness.view().activeKey).toBeNull()
  })
})
