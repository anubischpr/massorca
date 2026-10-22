import { afterEach, describe, expect, it, vi } from 'vitest'
import { JsonlRpcTimelineLane } from '../jsonl-rpc/timeline-lane'
import {
  closeProviderTimelineRigs,
  openProviderTimelineRig
} from '../native-chat/agent-session-timeline/provider-timeline-assembler-test-support'
import { PiRpcDialogCallbacks } from './rpc-dialog-callbacks'

afterEach(async () => {
  vi.useRealTimers()
  await closeProviderTimelineRigs()
})

async function open() {
  const rig = await openProviderTimelineRig({ agent: 'pi', sessionId: 'session-ask' })
  const lane = new JsonlRpcTimelineLane({
    sink: rig.sink,
    sessionId: 'session-ask',
    agent: 'pi',
    generation: 'gen-1',
    namespace: 'session-ask',
    pauseReading: vi.fn(),
    resumeReading: vi.fn(),
    onInputAccepted: vi.fn(),
    onFailed: vi.fn()
  })
  const sent: Record<string, unknown>[] = []
  const callbacks = new PiRpcDialogCallbacks(
    lane,
    async (frame) => void sent.push(frame),
    (error) => {
      throw error
    }
  )
  const questions = async () => {
    lane.flush()
    await lane.drained()
    return (await rig.rows()).filter((row) => row.body.kind === 'question')
  }
  return { callbacks, sent, questions, lane }
}

const round = (title: string, ...checked: boolean[]) => ({
  type: 'extension_ui_request',
  id: `${title}-${checked.map(Number).join('')}`,
  method: 'select',
  title,
  options: [...checked.map((on, index) => `[${on ? 'x' : ' '}] Option ${index}`), 'Done']
})

describe('Pi dialog callbacks for Gentle Shell questions', () => {
  it('turns a multi-select into one card and replays the picks as toggle rounds', async () => {
    const h = await open()
    h.callbacks.receive(round('Scope: What to ship?', false, false, false))
    const [row] = await h.questions()
    expect(row?.body).toMatchObject({
      kind: 'question',
      questions: [{ multiSelect: true, options: [{ label: 'Option 0' }, { label: 'Option 1' }, { label: 'Option 2' }] }]
    })
    await h.callbacks.respond(
      row!.itemId,
      { kind: 'answers', answers: [{ questionId: 'q1', optionIds: ['option-2', 'option-0'] }] },
      async () => {}
    )
    expect(h.sent).toEqual([
      { type: 'extension_ui_response', id: 'Scope: What to ship?-000', value: '[ ] Option 0' }
    ])
    h.callbacks.receive(round('Scope: What to ship?', true, false, false))
    h.callbacks.receive(round('Scope: What to ship?', true, false, true))
    expect(h.sent.slice(1).map((frame) => frame.value)).toEqual(['[ ] Option 2', 'Done'])
    expect(await h.questions()).toHaveLength(1)
  })

  it('shows a round it cannot continue as an ordinary card so the user is never stuck', async () => {
    const h = await open()
    h.callbacks.receive(round('Pick', true, false))
    expect(await h.questions()).toHaveLength(1)
    expect(h.sent).toEqual([])
  })

  it('refuses an empty multi-select answer without replying', async () => {
    const h = await open()
    h.callbacks.receive(round('Pick', false, false))
    const [row] = await h.questions()
    await expect(
      h.callbacks.respond(
        row!.itemId,
        { kind: 'answers', answers: [{ questionId: 'q1', optionIds: [] }] },
        async () => {}
      )
    ).rejects.toThrow('offered options')
    expect(h.sent).toEqual([])
  })

  it('cancels a pending question when the turn ends, so the agent never hangs', async () => {
    const h = await open()
    h.callbacks.receive({ type: 'extension_ui_request', id: 'd1', method: 'select', title: 'Pick', options: ['a', 'b'] })
    await h.questions()
    h.callbacks.cancelAll()
    expect(h.sent).toEqual([{ type: 'extension_ui_response', id: 'd1', cancelled: true }])
  })

  it('withdraws a card once Pi resolves it on its own deadline', async () => {
    vi.useFakeTimers()
    const h = await open()
    h.callbacks.receive({
      type: 'extension_ui_request',
      id: 'd2',
      method: 'select',
      title: 'Pick',
      options: ['a', 'b'],
      timeout: 5000
    })
    expect(await h.questions()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5001)
    const [withdrawn] = await h.questions()
    expect(withdrawn?.body).toMatchObject({ resolution: { state: expect.not.stringMatching('pending') } })
    expect(h.sent).toEqual([])
    h.callbacks.cancelAll()
    expect(h.sent).toEqual([])
  })
})
