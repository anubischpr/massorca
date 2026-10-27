/** The floating status pill above a structured chat's composer: "Working", the turn's elapsed time,
 *  and the running background tasks by kind. Pure text and counts; the view draws them. */

/** The kinds the pill counts: a terminal (shell command or monitor) and a background agent. Other
 *  kinds stay in the sheet, not in the pill's count. */
const TERMINAL_KINDS: ReadonlySet<string> = new Set(['command', 'monitor'])
const AGENT_KINDS: ReadonlySet<string> = new Set(['agent'])

export type MobileStatusPillGroup = {
  kind: string
  tasks: readonly { state: string }[]
}

export type MobileStatusPillCounts = { terminals: number; agents: number }

/** Running work only: every task whose state is not done counts. */
export function mobileStatusPillCounts(
  groups: readonly MobileStatusPillGroup[]
): MobileStatusPillCounts {
  let terminals = 0
  let agents = 0
  for (const group of groups) {
    const running = group.tasks.filter((task) => task.state !== 'done').length
    if (TERMINAL_KINDS.has(group.kind)) {
      terminals += running
    } else if (AGENT_KINDS.has(group.kind)) {
      agents += running
    }
  }
  return { terminals, agents }
}

/** `m:ss` under an hour, `h:mm:ss` from one hour on. Negative spans (clock skew) read as zero. */
export function formatMobileStatusPillElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const ss = String(seconds).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
  }
  return `${minutes}:${ss}`
}

export type MobileStatusPillInput = {
  /** A turn is running on this chat. */
  working: boolean
  /** Host-clock epoch ms the turn started, or null where the lane publishes no start (no clock). */
  startedAt: number | null
  /** Host-clock epoch ms now. */
  now: number
  counts: MobileStatusPillCounts
  /** False once the roster stream is lost: the pill then claims no live work. */
  live?: boolean
}

export type MobileStatusPill = {
  /** Whether the pill shows at all: a running turn or running background work. */
  visible: boolean
  label: 'Working' | 'Status unavailable'
  /** The elapsed clock, or null when the lane has no start to count from. */
  elapsed: string | null
  /** Counts are shown only when above zero. */
  terminals: number | null
  agents: number | null
}

export function mobileChatStatusPill(input: MobileStatusPillInput): MobileStatusPill {
  const hasWork = input.counts.terminals + input.counts.agents > 0
  if (input.live === false) {
    // Opening the sheet still shows the rows, each marked unverifiable; the pill states no count.
    return {
      visible: input.working || hasWork,
      label: 'Status unavailable',
      elapsed: null,
      terminals: null,
      agents: null
    }
  }
  return {
    visible: input.working || hasWork,
    label: 'Working',
    elapsed:
      input.working && input.startedAt !== null
        ? formatMobileStatusPillElapsed(input.now - input.startedAt)
        : null,
    terminals: input.counts.terminals > 0 ? input.counts.terminals : null,
    agents: input.counts.agents > 0 ? input.counts.agents : null
  }
}

/** The one line a screen reader hears for the pill, matching what it shows. */
export function mobileStatusPillAccessibilityLabel(pill: MobileStatusPill): string {
  const parts: string[] = [pill.label]
  if (pill.elapsed) {
    parts.push(pill.elapsed)
  }
  if (pill.terminals !== null) {
    parts.push(`${pill.terminals} ${pill.terminals === 1 ? 'terminal' : 'terminals'}`)
  }
  if (pill.agents !== null) {
    parts.push(`${pill.agents} ${pill.agents === 1 ? 'agent' : 'agents'}`)
  }
  return `Show background work, ${parts.join(', ')}`
}
