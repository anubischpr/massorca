import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordCrashBreadcrumb } from '../crash-reporting/crash-breadcrumb-store'
import { startSpan } from '../observability/tracer'
import {
  installWindowResponsivenessBreadcrumbs,
  startMainEventLoopLagBreadcrumbs
} from './main-thread-responsiveness-breadcrumbs'

vi.mock('../crash-reporting/crash-breadcrumb-store', () => ({ recordCrashBreadcrumb: vi.fn() }))
vi.mock('../observability/tracer', () => ({ startSpan: vi.fn(() => ({ end: vi.fn() })) }))

describe('main-thread responsiveness breadcrumbs', () => {
  let clock = 0
  const now = (): number => clock

  beforeEach(() => {
    vi.useFakeTimers()
    clock = 0
    vi.mocked(recordCrashBreadcrumb).mockClear()
    vi.mocked(startSpan).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('records event-loop lag past one second, and nothing for on-time ticks', () => {
    const stop = startMainEventLoopLagBreadcrumbs(now)
    clock += 500
    vi.advanceTimersByTime(500)
    clock += 500 + 900
    vi.advanceTimersByTime(500)
    expect(recordCrashBreadcrumb).not.toHaveBeenCalled()

    // A 12 s synchronous block: the next tick lands 12 s late.
    clock += 500 + 12_000
    vi.advanceTimersByTime(500)
    expect(recordCrashBreadcrumb).toHaveBeenCalledWith('main_event_loop_lag', { lagMs: 12_000 })
    expect(startSpan).toHaveBeenCalledWith('main.breadcrumb', {
      attributes: expect.objectContaining({
        'breadcrumb.name': 'main_event_loop_lag',
        'breadcrumb.data': { lagMs: 12_000 }
      })
    })
    stop()
  })

  it('brackets an unresponsive window with its duration', () => {
    const window = new EventEmitter()
    installWindowResponsivenessBreadcrumbs(window, 'main', now)

    window.emit('unresponsive')
    clock += 7_250
    window.emit('responsive')

    expect(vi.mocked(recordCrashBreadcrumb).mock.calls).toEqual([
      ['window_unresponsive', { surface: 'main' }],
      ['window_responsive', { surface: 'main', unresponsiveMs: 7_250 }]
    ])
  })
})
