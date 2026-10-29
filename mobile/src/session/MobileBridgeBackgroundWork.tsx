import { memo, useState } from 'react'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import type { StructuredSessionBackgroundTasksView } from '../../../src/shared/structured-session-background-tasks-view'
import { useNow } from '../hooks/use-now'
import { MobileBackgroundWorkSheet, type BackgroundWorkStopping } from './MobileBackgroundWorkSheet'
import { MobileChatStatusPillView } from './MobileChatStatusPillView'
import {
  NO_BACKGROUND_WORK_NOTE,
  UNLISTED_BACKGROUND_WORK_NOTE
} from './mobile-background-work-notes'
import {
  mobileChatStatusPill,
  mobileStatusPillCounts,
  mobileStatusPillFinishedCount
} from './mobile-chat-status-pill'
import { useMobileTerminalBackgroundWork } from './use-mobile-terminal-background-work'

// The host stops no pane subagent and lists no pane shell task, so the sheet offers no Stop here.
const NO_STOP_VIEW: StructuredSessionBackgroundTasksView = {
  show: true,
  isMonitoring: false,
  tasks: [],
  settledTasks: [],
  supportsStop: false,
  supportsStopAll: false
}
const NOT_STOPPING: BackgroundWorkStopping = { taskIds: new Set(), all: false }

function ignoreStop(): void {}

/** The status pill of a terminal-backed chat, with the background-work sheet it opens. Mounted per
 *  chat so its Finished list outlives the pill hiding between subagents; draws nothing while the
 *  agent is idle with nothing running or finished. */
function MobileBridgeBackgroundWorkImpl({
  scopeKey,
  status,
  working,
  connected
}: {
  scopeKey: string
  /** The pane's status row from the session tab; null before one is reported. */
  status: AgentStatusEntry | null | undefined
  /** The agent is mid-turn. */
  working: boolean
  /** This phone is hearing the paired host. */
  connected: boolean
}): React.JSX.Element | null {
  const [sheetOpen, setSheetOpen] = useState(false)
  // Ticks while a clock shows: a running turn or work the pane lists. Idle, the pill is gone.
  const now = useNow(1_000, working || (status?.subagents?.length ?? 0) > 0)
  const work = useMobileTerminalBackgroundWork({ scopeKey, status, connected, now })
  const hasRunning = work.groups.length > 0
  const hasDetail = hasRunning || work.unlistedWork || work.finished.length > 0
  if (sheetOpen && !hasDetail) {
    setSheetOpen(false)
  }
  const hostNow = now - work.rowContext.hostClockOffsetMs
  const pill = mobileChatStatusPill({
    working,
    startedAt: work.turnStartedAt,
    now: hostNow,
    counts: mobileStatusPillCounts(work.groups),
    hasBackgroundWork: hasRunning || work.unlistedWork,
    finishedCount: mobileStatusPillFinishedCount(work.finished),
    live: work.rowContext.transportObservation === 'live'
  })
  if (!pill.visible) {
    return null
  }
  // A plain working turn has nothing to open; the pill stays a status, as it was.
  return (
    <>
      <MobileChatStatusPillView
        pill={pill}
        onPress={hasDetail ? () => setSheetOpen(true) : undefined}
      />
      <MobileBackgroundWorkSheet
        visible={sheetOpen && hasDetail}
        onClose={() => setSheetOpen(false)}
        groups={work.groups}
        view={NO_STOP_VIEW}
        now={now}
        hostNow={hostNow}
        stopping={NOT_STOPPING}
        onStop={ignoreStop}
        finished={work.finished}
        emptyNote={work.unlistedWork ? UNLISTED_BACKGROUND_WORK_NOTE : NO_BACKGROUND_WORK_NOTE}
      />
    </>
  )
}

export const MobileBridgeBackgroundWork = memo(MobileBridgeBackgroundWorkImpl)
