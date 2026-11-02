import { existsSync } from 'node:fs'
import {
  BotTeamFileVersionsSelector,
  BotTeamVersionFileSelector,
  BotTeamVersionsSelector,
  type BotTeamVersionsResult
} from '../../../../shared/rpc-contract/bot-team-version-params'
import { gitExecFileAsync } from '../../../git/command-runner/git-exec-file'
import { probeGitAvailability } from '../../../git/git-availability'
import { toFailure } from '../../../bot-teams/bot-team-snapshot-run'
import { listBotTeamVersions } from '../../../bot-teams/bot-team-snapshots'
import { botTeamVersionDeps } from '../../../bot-teams/bot-team-version-deps'
import {
  botTeamFileVersions,
  botTeamLastVersionOfFile,
  readBotTeamVersionFile
} from '../../../bot-teams/bot-team-version-read'
import { restoreBotTeamFile } from '../../../bot-teams/bot-team-version-restore'
import { defineMethod } from '../core'

const GIT_PROBE_MS = 5000

/** Resolves false only when the host proved it has no Git; any other answer leaves versions on. */
async function hostHasGit(cwd: string): Promise<boolean> {
  try {
    return await probeGitAvailability(
      (args, options) => gitExecFileAsync(args, { cwd: options.cwd, timeout: options.timeout }),
      { cwd, timeout: GIT_PROBE_MS }
    )
  } catch {
    return true
  }
}

async function readVersions(teamId: string): Promise<BotTeamVersionsResult> {
  const deps = botTeamVersionDeps(teamId)
  // A team whose first task has not started has no folder, and so nothing to save.
  if (!existsSync(deps.folder)) {
    return { git: 'ok', versions: [], lastVersionOfFile: {} }
  }
  try {
    const versions = await listBotTeamVersions(deps)
    if (versions.length === 0) {
      return (await hostHasGit(deps.folder))
        ? { git: 'ok', versions, lastVersionOfFile: {} }
        : { git: 'unavailable' }
    }
    return { git: 'ok', versions, lastVersionOfFile: await botTeamLastVersionOfFile(deps) }
  } catch (error) {
    const failure = toFailure(error)
    if (failure.reason === 'git-unavailable') {
      return { git: 'unavailable' }
    }
    throw failure
  }
}

export const BOT_TEAM_VERSION_METHODS = [
  defineMethod({
    name: 'botTeams.versions',
    permission: 'workspace',
    params: BotTeamVersionsSelector,
    handler: ({ teamId }) => readVersions(teamId)
  }),
  defineMethod({
    name: 'botTeams.fileVersions',
    permission: 'workspace',
    params: BotTeamFileVersionsSelector,
    handler: async ({ teamId, relativePath }) => {
      const deps = botTeamVersionDeps(teamId)
      return {
        versions: existsSync(deps.folder) ? await botTeamFileVersions(deps, relativePath) : []
      }
    }
  }),
  defineMethod({
    name: 'botTeams.versionFile',
    permission: 'workspace',
    params: BotTeamVersionFileSelector,
    handler: async ({ teamId, versionId, relativePath }) => ({
      file: await readBotTeamVersionFile(botTeamVersionDeps(teamId), versionId, relativePath)
    })
  }),
  defineMethod({
    name: 'botTeams.restoreFileVersion',
    permission: 'workspace',
    params: BotTeamVersionFileSelector,
    handler: async ({ teamId, versionId, relativePath }) => ({
      result: await restoreBotTeamFile(botTeamVersionDeps(teamId), versionId, relativePath)
    })
  })
]
