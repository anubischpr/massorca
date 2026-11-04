import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { useBotTeamHost } from '@/runtime/bot-team-host'
import { ensureBotTeamFolderWorkspace } from '@/runtime/runtime-bot-team-client'
import type { BotTeamRoomAttachment } from '../../../../shared/bot-team-room-attachments'
import {
  attachBotTeamRoomFiles,
  botTeamRoomAttachmentsSupported
} from './bot-team-room-attach-upload'

/**
 * Picks files on this computer; the team folder is made only once something was picked, so a
 * cancelled pick leaves no folder behind.
 */
async function pickAndAttach(host: string, teamId: string): Promise<BotTeamRoomAttachment[]> {
  const picked = await window.api.shell.pickAttachments()
  if (picked.length === 0) {
    return []
  }
  try {
    const folder = await ensureBotTeamFolderWorkspace(teamId)
    const { attachments, failed } = await attachBotTeamRoomFiles({
      host,
      workspaceId: folder.workspaceId,
      folderPath: folder.folderPath,
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
 * The room's file action: undefined until the team's host takes files in its room. The team
 * folder does not have to exist yet; the first pick creates it.
 */
export function useBotTeamRoomAttachments({
  teamId
}: {
  teamId: string
}): (() => Promise<BotTeamRoomAttachment[]>) | undefined {
  const host = useBotTeamHost()
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    let current = true
    setSupported(false)
    void botTeamRoomAttachmentsSupported(host).then((yes) => {
      if (current) {
        setSupported(yes)
      }
    })
    return () => {
      current = false
    }
  }, [teamId, host])
  if (!supported) {
    return undefined
  }
  return () => pickAndAttach(host, teamId)
}
