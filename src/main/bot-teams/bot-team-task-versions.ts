import { existsSync } from 'node:fs'
import type { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { getStructuredAgentSessionHost } from '../native-chat/agent-session-wire/structured-agent-session-registry'
import { botTeamVersionDeps } from './bot-team-version-deps'
import { watchBotTeamTaskFinishes } from './bot-team-version-watcher'
import { watchBotTeamTaskLastStatus } from './bot-team-task-status-record'
import { takeBotTeamSnapshot } from './bot-team-snapshots'
import type { BotTeamSnapshotDeps } from './bot-team-snapshot-types'

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

const watchedHosts = new WeakSet<object>()

/** Starts once per host: a task that finishes while its team's room is closed is still saved. */
export function ensureBotTeamVersionWatcher(getDb: () => OrchestrationDb): void {
  const host = getStructuredAgentSessionHost()
  if (!host || watchedHosts.has(host)) {
    return
  }
  watchedHosts.add(host)
  watchBotTeamTaskFinishes(host, (sessionId) => {
    void saveVersionOfFinishedTask(getDb(), sessionId).catch((error: unknown) =>
      console.warn('[bot-teams] saving a version failed', error)
    )
  })
  // A board's first paint reads the last status a task's session reached.
  watchBotTeamTaskLastStatus(host, (sessionId, status) =>
    getDb().setBotTeamTaskLastStatus(sessionId, status)
  )
}
