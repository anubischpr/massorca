import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import { botTeamFolderWorkspaceId } from '@/runtime/runtime-bot-team-client'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import {
  attachBotTeamRoomFiles,
  botTeamFolderPathOnHost,
  botTeamRoomAttachmentsSupported
} from './bot-team-room-attach-upload'

/** Picks files on this computer and copies them into the team folder; a file that did not copy is named once. */
async function pickAndAttach(host: string, workspaceId: string): Promise<BotTeamRoomAttachment[]> {
  const picked = await window.api.shell.pickAttachments()
  if (picked.length === 0) {
    return []
  }
  try {
    const { attachments, failed } = await attachBotTeamRoomFiles({
      host,
      workspaceId,
      sourcePaths: picked
    })
    if (failed.length > 0) {
      toast.error(
        translate('components.botTeams.attachFailed', "Couldn't attach {{files}}.", {
          files: failed.map((entry) => basename(entry.sourcePath)).join(', ')
        })
      )
    }
    return attachments
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
    return []
  }
}

/**
 * The room's file action: undefined until the team folder exists on its host and that host takes
 * files in its room, so the composer's "+" appears only when a pick can land.
 */
export function useBotTeamRoomAttachments({
  teamId,
  taskCount
}: {
  teamId: string
  taskCount: number
}): (() => Promise<BotTeamRoomAttachment[]>) | undefined {
  const host = useBotTeamHost()
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setWorkspaceId(null)
    void (async () => {
      const found = await botTeamFolderWorkspaceId(teamId)
      if (found === null || botTeamFolderPathOnHost(found, host) === null) {
        return
      }
      if ((await botTeamRoomAttachmentsSupported(host)) && current) {
        setWorkspaceId(found)
      }
    })()
    return () => {
      current = false
    }
  }, [teamId, host, taskCount])
  if (workspaceId === null) {
    return undefined
  }
  return () => pickAndAttach(host, workspaceId)
}
