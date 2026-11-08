import { useMemo } from 'react'
import { formatNativeChatFileReference } from '../../../../shared/agent-image-paste'
import type { NativeChatMentionChip } from './native-chat-composer-input'
import { useConnectedMarketplaceApps } from '../marketplace/use-connected-marketplace-apps'
import {
  useNativeChatMentionFiles,
  type NativeChatMentionFiles,
  type NativeChatMentionProject
} from './use-native-chat-mention-files'

/** The chip a choice from the @ menu becomes: an app or project it names, else a file. */
export function nativeChatMentionChip(
  choice: string,
  mention: NativeChatMentionFiles
): NativeChatMentionChip {
  const app = mention.apps?.find((entry) => entry.name === choice)
  const project = mention.projects?.find((entry) => entry.path === choice)
  const token = formatNativeChatFileReference(choice)
  if (app) {
    return { token, label: choice, kind: 'app', appId: app.id }
  }
  return project
    ? { token, label: project.name, kind: 'project' }
    : { token, label: choice, kind: 'file' }
}

/** The @ menu's files, then the offered projects and connected apps whose name holds the query. */
export function useNativeChatMentionFilesAndApps(
  args: Parameters<typeof useNativeChatMentionFiles>[0] & {
    projects?: readonly NativeChatMentionProject[]
  }
): NativeChatMentionFiles {
  const mention = useNativeChatMentionFiles(args)
  const connected = useConnectedMarketplaceApps()
  const { query, projects: offered } = args
  return useMemo(() => {
    const typed = query?.toLowerCase()
    if (typed === undefined) {
      return mention
    }
    const projects = (offered ?? []).filter((project) => project.name.toLowerCase().includes(typed))
    const apps = connected.filter((app) => app.name.toLowerCase().includes(typed))
    return projects.length > 0 || apps.length > 0
      ? {
          ...mention,
          files: [
            ...mention.files,
            ...projects.map((project) => project.path),
            ...apps.map((app) => app.name)
          ],
          projects,
          apps
        }
      : mention
  }, [connected, mention, offered, query])
}
