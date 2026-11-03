import { useState } from 'react'
import { Alert } from 'react-native'
import {
  BOT_TEAM_ROOM_ATTACHMENT_LIMIT,
  type BotTeamRoomAttachment
} from '../../../src/shared/bot-team-room-attachments'
import { CLIPBOARD_IMAGE_MAX_SOURCE_BYTES } from '../../../src/shared/clipboard-image'
import type { RpcClient } from '../transport/rpc-client'
import {
  uploadMobileBotTeamRoomFile,
  useMobileBotTeamRoomAttachSupport
} from './mobile-bot-team-attach'
import { pickMobileBotTeamRoomFile } from './mobile-bot-team-attach-pick'

/**
 * The files a room holds for its next message. The attach action exists only when the host
 * advertises room attachments, and files ride only to such a host.
 */
export function useMobileBotTeamRoomAttachments({
  client,
  workspaceId,
  enabled
}: {
  client: RpcClient
  workspaceId: string | null
  enabled: boolean
}) {
  const supported = useMobileBotTeamRoomAttachSupport(client, enabled)
  const [files, setFiles] = useState<BotTeamRoomAttachment[]>([])
  const [attaching, setAttaching] = useState(false)

  // Copies the picked file into the team folder; it rides with the next message the person sends.
  const attachFile = async (): Promise<void> => {
    if (workspaceId === null || attaching) {
      return
    }
    if (files.length >= BOT_TEAM_ROOM_ATTACHMENT_LIMIT) {
      Alert.alert(
        'That is the most',
        `A message can carry up to ${BOT_TEAM_ROOM_ATTACHMENT_LIMIT} files.`
      )
      return
    }
    setAttaching(true)
    try {
      const picked = await pickMobileBotTeamRoomFile()
      if (picked === null) {
        return
      }
      if (picked.size !== null && picked.size > CLIPBOARD_IMAGE_MAX_SOURCE_BYTES) {
        Alert.alert('That file did not attach', 'It is too large to attach from the phone.')
        return
      }
      const uploaded = await uploadMobileBotTeamRoomFile(client, {
        workspaceId,
        name: picked.name,
        contentBase64: await picked.base64()
      })
      if (uploaded.kind === 'attached') {
        setFiles((current) => [...current, uploaded.attachment])
        return
      }
      Alert.alert(
        'That file did not attach',
        uploaded.kind === 'too-large'
          ? 'It is too large to attach from the phone.'
          : 'Check the connection to this host and try again.'
      )
    } catch {
      Alert.alert('That file did not attach', 'Check the connection to this host and try again.')
    } finally {
      setAttaching(false)
    }
  }

  return {
    /** The composer's plus action; undefined when the room cannot take files now. */
    attachFile: supported && enabled && workspaceId !== null ? attachFile : undefined,
    attaching,
    files,
    /** The files the next send carries. */
    postable: supported ? files : [],
    removeFile: (path: string) =>
      setFiles((current) => current.filter((file) => file.path !== path)),
    /** Drops the files a send carried once the host has taken the message. */
    clearPosted: (posted: readonly BotTeamRoomAttachment[]) =>
      setFiles((current) => current.filter((file) => !posted.includes(file)))
  }
}
