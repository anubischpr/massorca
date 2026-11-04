import { useMemo } from 'react'
import { useConnectedMarketplaceApps } from '../marketplace/use-connected-marketplace-apps'
import {
  useNativeChatMentionFiles,
  type NativeChatMentionFiles
} from './use-native-chat-mention-files'

/** The @ menu's files followed by the connected apps whose name holds the query. */
export function useNativeChatMentionFilesAndApps(
  args: Parameters<typeof useNativeChatMentionFiles>[0]
): NativeChatMentionFiles {
  const mention = useNativeChatMentionFiles(args)
  const connected = useConnectedMarketplaceApps()
  const { query } = args
  return useMemo(() => {
    const typed = query?.toLowerCase()
    const apps =
      typed === undefined ? [] : connected.filter((app) => app.name.toLowerCase().includes(typed))
    return apps.length > 0
      ? { ...mention, files: [...mention.files, ...apps.map((app) => app.name)], apps }
      : mention
  }, [connected, mention, query])
}
