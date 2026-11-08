import type { CrashReportBreadcrumbData } from '../../shared/crash-reporting'
import { recordCrashBreadcrumb } from '../crash-reporting/crash-breadcrumb-store'
import { startSpan } from '../observability/tracer'

const LAG_SAMPLE_MS = 500
/** Windows paints "(Not Responding)" after ~5 s; 1 s of lag is already a visible stutter. */
export const EVENT_LOOP_LAG_BREADCRUMB_MS = 1_000

/** Crash-store breadcrumb plus a zero-length trace span, so it survives a hang the process never leaves. */
function recordMainBreadcrumb(name: string, data: CrashReportBreadcrumbData): void {
  recordCrashBreadcrumb(name, data)
  startSpan('main.breadcrumb', {
    attributes: { kind: 'crash-breadcrumb', 'breadcrumb.name': name, 'breadcrumb.data': data }
  }).end()
}

/**
 * Records `main_event_loop_lag` when a timer fires a second or more late: the main thread was
 * blocked (a synchronous spawn, fs call or long task) for that long. Returns the stopper.
 */
export function startMainEventLoopLagBreadcrumbs(
  now: () => number = () => performance.now()
): () => void {
  let expectedAt = now() + LAG_SAMPLE_MS
  const timer = setInterval(() => {
    const firedAt = now()
    const lagMs = firedAt - expectedAt
    expectedAt = firedAt + LAG_SAMPLE_MS
    if (lagMs >= EVENT_LOOP_LAG_BREADCRUMB_MS) {
      recordMainBreadcrumb('main_event_loop_lag', { lagMs: Math.round(lagMs) })
    }
  }, LAG_SAMPLE_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}

/** Brackets a renderer hang the OS reports as "(Not Responding)" with its duration. */
export function installWindowResponsivenessBreadcrumbs(
  window: { on(event: 'unresponsive' | 'responsive', listener: () => void): unknown },
  surface: string,
  now: () => number = () => performance.now()
): void {
  let unresponsiveAt: number | null = null
  window.on('unresponsive', () => {
    unresponsiveAt = now()
    recordMainBreadcrumb('window_unresponsive', { surface })
  })
  window.on('responsive', () => {
    const unresponsiveMs = unresponsiveAt === null ? null : Math.round(now() - unresponsiveAt)
    unresponsiveAt = null
    recordMainBreadcrumb('window_responsive', { surface, unresponsiveMs })
  })
}
