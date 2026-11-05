import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { nativeChatVisualsFolderFor } from '../native-chat/native-chat-visuals-folder'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import { botTeamFolderPath, botTeamVersionDeps } from './bot-team-version-deps'
import { watchBotTeamTaskFinishes } from './bot-team-version-watcher'
import { watchBotTeamTaskLastStatus } from './bot-team-task-status-record'
import { reportFinishedBotTeamTask } from './bot-team-finish-report'
import { botTeamReturnDeps, returnFinishedBotTeamTask } from './bot-team-return'
import { takeBotTeamSnapshot } from './bot-team-snapshots'
import type { BotTeamSnapshotDeps } from './bot-team-snapshot-types'
import { rememberSessionWorkspaces } from './bot-team-worktree-deliverables'

/** Saves the team's folder as a version once the task of this session is done. */
export async function saveVersionOfFinishedTask(
  db: OrchestrationDb,
  sessionId: string,
  versionDeps: (teamId: string) => BotTeamSnapshotDeps = botTeamVersionDeps
): Promise<void> {
  const task = db.findBotTeamTaskBySession(sessionId)
  if (!task) {
    return
  }
  const deps = versionDeps(task.teamId)
  if (!existsSync(deps.folder)) {
    return
  }
  const owner = db
    .listBotTeams()
    .find((team) => team.id === task.teamId)
    ?.bots.find((bot) => bot.id === task.ownerBotId)
  const result = await takeBotTeamSnapshot(deps, {
    reason: 'task-finished',
    label: task.title,
    ...(owner ? { author: owner.name } : {})
  })
  if (!result.ok) {
    // The task is done either way, so a failed save only leaves the folder without that version.
    console.warn('[bot-teams] could not save a version of a finished task', result.reason)
  }
}

/** A chat's visuals folder on this host, named by the same resolver the chat's launch uses. */
function chatVisualsFolderOf(sessionId: string): string {
  return nativeChatVisualsFolderFor(getProfileUserDataPath(), sessionId)
}

/** The workspace a chat ran in, from the host that holds its record; null when this host does not hold it. */
function readSessionWorkspaceOf(sessionId: string): string | null {
  return (
    getStructuredAgentSessionHost()?.deps.store.getRecord(sessionId)?.location.workspaceId ?? null
  )
}

const watchedHosts = new WeakSet<object>()

/** Starts once per host: a task that finishes while its team's room is closed is still saved. */
export function ensureBotTeamVersionWatcher(getDb: () => OrchestrationDb): void {
  const host = getStructuredAgentSessionHost()
  if (!host || watchedHosts.has(host)) {
    return
  }
  watchedHosts.add(host)
  // The finish event does not name the workspace, so the status feed says which one each session ran in.
  const workspaces = new Map<string, string>()
  host.subscribeStatus({
    id: `bot-team-workspaces-${randomUUID()}`,
    emit: (event) => rememberSessionWorkspaces(workspaces, event)
  })
  watchBotTeamTaskFinishes(host, (sessionId) => {
    const workspaceId = workspaces.get(sessionId) ?? null
    workspaces.delete(sessionId)
    void saveVersionOfFinishedTask(getDb(), sessionId).catch((error: unknown) =>
      console.warn('[bot-teams] saving a version failed', error)
    )
    void reportFinishedBotTeamTask(getDb(), sessionId, {
      folderOf: botTeamFolderPath,
      settleMs: 3000,
      sessionWorkspaceId: workspaceId,
      visualsFolderOf: chatVisualsFolderOf,
      workspaceOfSession: readSessionWorkspaceOf
    }).catch((error: unknown) =>
      console.warn('[bot-teams] reporting a finished task failed', error)
    )
    // A task another team asked for tells that team's room once it is done.
    void returnFinishedBotTeamTask(getDb(), sessionId, botTeamReturnDeps(workspaceId)).catch(
      (error: unknown) => console.warn('[bot-teams] returning a finished task failed', error)
    )
  })
  // A board's first paint reads the last status a task's session reached.
  watchBotTeamTaskLastStatus(host, (sessionId, status) =>
    getDb().setBotTeamTaskLastStatus(sessionId, status)
  )
}
