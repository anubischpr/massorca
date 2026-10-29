// @vitest-environment happy-dom

import { act, cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NATIVE_CHAT_VISUAL_ANNOTATE_TYPE,
  NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE,
  NATIVE_CHAT_VISUAL_PINS_TYPE,
  NATIVE_CHAT_VISUAL_OVERRIDES_TYPE,
  NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE,
  type NativeChatVisualAnnotateEvent,
  type NativeChatVisualAnnotateState
} from '../../../../shared/native-chat-visual-annotate'
import { NATIVE_CHAT_VISUAL_FRAME_NAME_PREFIX } from '../../../../shared/native-chat-visual-shell'

vi.mock('@/lib/http-link-routing', () => ({ openHttpLink: vi.fn() }))

import { NativeChatVisualFrame } from './NativeChatVisualFrame'

const visual = { revision: 'r1', html: '<p>chart</p>' }

const annotating: NativeChatVisualAnnotateState = {
  enabled: true,
  pins: [{ pinKey: 'p1', number: 1, selector: '#app', active: false }],
  overrides: []
}

type HarnessProps = {
  annotate?: NativeChatVisualAnnotateState
  onAnnotateEvent?: (event: NativeChatVisualAnnotateEvent) => void
}

function Harness({ annotate, onAnnotateEvent }: HarnessProps) {
  const scope = useRef<HTMLDivElement | null>(null)
  return (
    <div ref={scope}>
      <NativeChatVisualFrame
        document={visual}
        title="Chart"
        layout="inline"
        themeScope={scope}
        onRetired={() => {}}
        annotate={annotate}
        onAnnotateEvent={onAnnotateEvent}
      />
    </div>
  )
}

function renderFrame(props: HarnessProps) {
  const view = render(<Harness {...props} />)
  const frame = view.container.querySelector('iframe')
  const contentWindow = frame?.contentWindow
  if (!frame || !contentWindow) {
    throw new Error('no frame')
  }
  const posted = vi.fn()
  vi.spyOn(contentWindow, 'postMessage').mockImplementation(posted)
  return { ...view, frame, contentWindow, posted }
}

function channelOf(frame: HTMLIFrameElement): string {
  return frame.name.slice(NATIVE_CHAT_VISUAL_FRAME_NAME_PREFIX.length)
}

function load(frame: HTMLIFrameElement): void {
  act(() => {
    frame.dispatchEvent(new Event('load'))
  })
}

function post(data: unknown, source: MessageEventSource | null): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source }))
  })
}

const element = {
  selector: '#app > p:nth-of-type(1)',
  label: 'chart',
  rect: { x: 1, y: 2, width: 3, height: 4 },
  htmlSnippet: '<p>chart</p>',
  state: {
    text: 'chart',
    color: '#000000',
    bg: '#ffffff',
    width: { value: 3, unit: 'px' },
    height: { value: 4, unit: 'px' },
    fontSize: 16
  }
}

afterEach(() => {
  cleanup()
})

describe('NativeChatVisualFrame annotate', () => {
  it('builds no annotate script unless the frame is given annotate state', () => {
    const { frame } = renderFrame({})
    expect(frame.srcdoc).not.toContain('data-orca-annotate')
  })

  it('builds the annotate script, and posts the whole state once the frame loads', () => {
    const { frame, posted } = renderFrame({ annotate: annotating })
    expect(frame.srcdoc).toContain('data-orca-annotate')
    load(frame)
    const channel = channelOf(frame)
    expect(posted.mock.calls.map(([message]) => message)).toEqual(
      expect.arrayContaining([
        { type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, channel, enabled: true },
        { type: NATIVE_CHAT_VISUAL_PINS_TYPE, channel, pins: annotating.pins },
        { type: NATIVE_CHAT_VISUAL_OVERRIDES_TYPE, channel, overrides: [] }
      ])
    )
  })

  it('reports a pick and a pin click from its own frame, and ignores one from anywhere else', () => {
    const onAnnotateEvent = vi.fn()
    const { frame, contentWindow } = renderFrame({ annotate: annotating, onAnnotateEvent })
    load(frame)
    const channel = channelOf(frame)

    post({ type: NATIVE_CHAT_VISUAL_ELEMENT_PICKED_TYPE, channel, element }, contentWindow)
    post({ type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel, pinKey: 'p1' }, contentWindow)
    expect(onAnnotateEvent.mock.calls).toEqual([
      [{ kind: 'element-picked', element }],
      [{ kind: 'pin-clicked', pinKey: 'p1' }]
    ])

    post({ type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel, pinKey: 'p1' }, null)
    post(
      { type: NATIVE_CHAT_VISUAL_PIN_CLICKED_TYPE, channel: 'other', pinKey: 'p1' },
      contentWindow
    )
    expect(onAnnotateEvent).toHaveBeenCalledTimes(2)
  })

  it('posts the state again when it changes', () => {
    const renderWith = (annotate: NativeChatVisualAnnotateState) => (
      <Harness annotate={annotate} onAnnotateEvent={() => {}} />
    )
    const view = render(renderWith(annotating))
    const frame = view.container.querySelector<HTMLIFrameElement>('iframe')
    const contentWindow = frame?.contentWindow
    if (!frame || !contentWindow) {
      throw new Error('no frame')
    }
    const posted = vi.fn()
    vi.spyOn(contentWindow, 'postMessage').mockImplementation(posted)
    load(frame)
    posted.mockClear()

    view.rerender(renderWith({ ...annotating, enabled: false }))
    expect(posted).toHaveBeenCalledWith(
      { type: NATIVE_CHAT_VISUAL_ANNOTATE_TYPE, channel: channelOf(frame), enabled: false },
      '*'
    )
  })
})
