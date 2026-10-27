import type { ActivePanel } from './session-panel-host'

export type MobileChatChromeSegmentId = 'chat' | 'files' | 'sourceControl'

export type MobileChatChromeSegment = {
  id: MobileChatChromeSegmentId
  label: string
  active: boolean
}

export type MobileChatChromeSegmentInput = {
  activePanel: ActivePanel
  /** Folder and floating workspaces have no file explorer in the header today, so none here. */
  showFiles: boolean
  /** Folder and floating workspaces have no source control in the header today, so none here. */
  showSourceControl: boolean
}

/**
 * The floating segmented control: Chat is the transcript (no panel open), and Files and Source
 * control show the panels the header's folder and branch icons show.
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
  if (input.showSourceControl) {
    segments.push({
      id: 'sourceControl',
      label: 'Source control',
      active: input.activePanel === 'sourceControl'
    })
  }
  return segments
}

/** The panel a segment opens, or null for Chat, which closes the docked panel instead. */
export function mobileChatChromeSegmentPanel(
  id: MobileChatChromeSegmentId
): Exclude<ActivePanel, null> | null {
  switch (id) {
    case 'chat':
      return null
    case 'files':
      return 'files'
    case 'sourceControl':
      return 'sourceControl'
  }
}
