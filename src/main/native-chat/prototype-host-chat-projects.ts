// The host chats the prototype list reads projects from, so a project whose chats never made a prototype
// request still lists its design system, with the chat its edits go to.

import type { PrototypeListedChat } from '../../shared/rpc-contract/prototype-params'
import { projectsOfLaunchDirectories, type ListedProject } from './prototype-design-system-files'

// Why bounded: each chat costs a project lookup on every Prototypes open.
const MAX_HOST_CHATS_SCANNED = 200

type LaunchDirectoryOf = (sessionId: string) => string | undefined | Promise<string | undefined>

type HostChatDirectory = { chat: PrototypeListedChat; launchDirectory: string }

/**
 * The project of each launch directory, the requests' and the host chats', and the newest host chat of each
 * project by project key.
 */
export async function projectsOfRequestsAndChats(
  requestLaunchDirectories: Iterable<string>,
  hostChats: readonly PrototypeListedChat[],
  launchDirectoryOf: LaunchDirectoryOf | undefined
): Promise<{
  projects: Map<string, ListedProject>
  newestChats: Map<string, PrototypeListedChat>
}> {
  const chatDirectories = await hostChatDirectories(hostChats, launchDirectoryOf)
  const projects = await projectsOfLaunchDirectories([
    ...requestLaunchDirectories,
    ...chatDirectories.map((entry) => entry.launchDirectory)
  ])
  return { projects, newestChats: newestChatOfEachProject(chatDirectories, projects) }
}

/** The newest host chats, each with its launch directory; a chat with none is left out. */
async function hostChatDirectories(
  hostChats: readonly PrototypeListedChat[],
  launchDirectoryOf: LaunchDirectoryOf | undefined
): Promise<HostChatDirectory[]> {
  const listed: HostChatDirectory[] = []
  for (const chat of hostChats.slice(0, MAX_HOST_CHATS_SCANNED)) {
    const launchDirectory = await launchDirectoryOf?.(chat.sessionId)
    if (launchDirectory !== undefined) {
      listed.push({ chat, launchDirectory })
    }
  }
  return listed
}

// Why the first only: host chats come newest first.
function newestChatOfEachProject(
  chatDirectories: readonly HostChatDirectory[],
  projects: ReadonlyMap<string, ListedProject>
): Map<string, PrototypeListedChat> {
  const newest = new Map<string, PrototypeListedChat>()
  for (const { chat, launchDirectory } of chatDirectories) {
    const project = projects.get(launchDirectory)
    if (project !== undefined && !newest.has(project.projectKey)) {
      newest.set(project.projectKey, chat)
    }
  }
  return newest
}
