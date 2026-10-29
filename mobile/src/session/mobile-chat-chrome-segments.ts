import type { ActivePanel } from './session-panel-host'

export type MobileChatChromeSegmentId = 'chat' | 'files' | 'terminal'

export type MobileChatChromeSegment = {
  id: MobileChatChromeSegmentId
  label: string
  active: boolean
}

export type MobileChatChromeSegmentInput = {
  activePanel: ActivePanel
  /** Folder and floating workspaces have no file explorer in the header today, so none here. */
  showFiles: boolean
}

/**
 * The floating segmented control: Chat is the transcript (no panel open), Files opens the file
 * explorer, and Terminal opens the worktree's terminals. Source control lives in the ⋯ menu only.
 * Terminal is offered on every workspace kind, as the New Tab sheet offers it.
 */
export function resolveMobileChatChromeSegments(
  input: MobileChatChromeSegmentInput
): MobileChatChromeSegment[] {
  const segments: MobileChatChromeSegment[] = [
    { id: 'chat', label: 'Chat', active: input.activePanel === null }
  ]
  if (input.showFiles) {
    segments.push({ id: 'files', label: 'Files', active: input.activePanel === 'files' })
  }
  segments.push({ id: 'terminal', label: 'Terminal', active: input.activePanel === 'terminal' })
  return segments
}

/** The panel a segment opens, or null for Chat, which returns to the chat instead. */
export function mobileChatChromeSegmentPanel(
  id: MobileChatChromeSegmentId
): Exclude<ActivePanel, null> | null {
  switch (id) {
    case 'chat':
      return null
    case 'files':
      return 'files'
    case 'terminal':
      return 'terminal'
  }
}
