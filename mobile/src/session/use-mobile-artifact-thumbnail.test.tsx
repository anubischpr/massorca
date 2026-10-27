import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { MobileArtifactTarget } from './mobile-chat-artifacts-model'
import type { MobileChatSurfaceRecordedSource } from './mobile-chat-surface-snapshot'
import { useArtifactThumbnail } from './use-mobile-artifact-thumbnail'
import { readRecordedFilePreview, cachedRecordedFileContent } from './mobile-recorded-file-cache'

vi.mock('./mobile-artifact-read-limiter', () => ({
  artifactThumbnailLimiter: (task: () => Promise<unknown>) => task()
}))
vi.mock('./mobile-recorded-file-cache', () => ({
  cachedRecordedFileContent: vi.fn(() => null),
  readRecordedFilePreview: vi.fn(() => Promise.resolve(null))
}))
vi.mock('./mobile-native-chat-visual-read', () => ({
  cachedMobileNativeChatVisual: vi.fn(() => null),
  readMobileNativeChatVisual: vi.fn(() => Promise.resolve({ kind: 'refused' }))
}))

const read = vi.mocked(readRecordedFilePreview)
const cached = vi.mocked(cachedRecordedFileContent)
const PAGE: MobileArtifactTarget = { kind: 'recorded', path: 'C:/work/usage.html' }

function sourceOf(sessionId: string): MobileChatSurfaceRecordedSource {
  return { client: {} as RpcClient, sessionId }
}

/** Renders what a tile would: the page's HTML, or the glyph. */
function Probe({
  target,
  source,
  active
}: {
  target: MobileArtifactTarget
  source: MobileChatSurfaceRecordedSource | null
  active: boolean
}) {
  const thumbnail = useArtifactThumbnail(target, source, active)
  return createElement('Probe', { html: thumbnail.kind === 'page' ? thumbnail.html : null })
}

function htmlOf(renderer: ReactTestRenderer): string | null {
  return renderer.root.findByType('Probe' as never).props.html
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('useArtifactThumbnail', () => {
  let renderers: ReactTestRenderer[] = []

  beforeEach(() => {
    read.mockReset()
    cached.mockReset()
    cached.mockReturnValue(null)
    read.mockResolvedValue(null)
  })

  afterEach(() => {
    for (const renderer of renderers) {
      try {
        act(() => renderer.unmount())
      } catch {
        // Already unmounted by the test that frees its slot.
      }
    }
    renderers = []
  })

  function mount(props: Parameters<typeof Probe>[0]): ReactTestRenderer {
    let renderer: ReactTestRenderer | null = null
    act(() => {
      renderer = create(createElement(Probe, props))
    })
    if (renderer === null) {
      throw new Error('renderer not created')
    }
    renderers.push(renderer)
    return renderer
  }

  it('loads once a source appears after mount, rather than staying a glyph', async () => {
    read.mockResolvedValue('<h1>usage</h1>')
    const renderer = mount({ target: PAGE, source: null, active: true })
    await flush()
    expect(htmlOf(renderer)).toBeNull()
    expect(read).not.toHaveBeenCalled()
    act(() => {
      renderer.update(createElement(Probe, { target: PAGE, source: sourceOf('s1'), active: true }))
    })
    await flush()
    expect(htmlOf(renderer)).toBe('<h1>usage</h1>')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('paints the cached copy first, then revalidates and replaces it with the host answer', async () => {
    cached.mockReturnValue('<h1>old</h1>')
    read.mockResolvedValue('<h1>new</h1>')
    const renderer = mount({ target: PAGE, source: sourceOf('s1'), active: true })
    expect(htmlOf(renderer)).toBe('<h1>old</h1>')
    await flush()
    expect(htmlOf(renderer)).toBe('<h1>new</h1>')
    expect(read).toHaveBeenCalledWith({ client: expect.anything(), sessionId: 's1' }, PAGE.path, {
      revalidate: true
    })
  })

  it('keeps the last copy when the host gives no answer for the revalidation', async () => {
    cached.mockReturnValue('<h1>kept</h1>')
    read.mockResolvedValue(null)
    const renderer = mount({ target: PAGE, source: sourceOf('s1'), active: true })
    await flush()
    expect(htmlOf(renderer)).toBe('<h1>kept</h1>')
  })

  it('shows at most six live previews at once, and frees a slot when a tile unmounts', async () => {
    read.mockResolvedValue('<h1>x</h1>')
    const source = sourceOf('s1')
    const tiles = Array.from({ length: 7 }, (_, index) => ({
      kind: 'recorded' as const,
      path: `C:/work/page-${index}.html`
    }))
    const renderers = tiles.map((target) => mount({ target, source, active: true }))
    await flush()
    const live = renderers.filter((renderer) => htmlOf(renderer) !== null)
    expect(live).toHaveLength(6)
    const [gone, ...stillMounted] = live
    act(() => gone.unmount())
    await flush()
    expect(stillMounted.filter((renderer) => htmlOf(renderer) !== null)).toHaveLength(5)
    const waiting = renderers.find((renderer) => !live.includes(renderer)) ?? null
    expect(waiting && htmlOf(waiting)).toBe('<h1>x</h1>')
  })
})
