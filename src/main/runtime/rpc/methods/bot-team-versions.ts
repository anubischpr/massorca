import { existsSync } from 'node:fs'
import {
  BotTeamFileVersionsSelector,
  BotTeamVersionFileSelector,
  BotTeamVersionsSelector,
  type BotTeamVersionsResult
} from '../../../../shared/rpc-contract/bot-team-version-params'
import { listBotTeamVersions } from '../../../bot-teams/bot-team-snapshots'
import { botTeamVersionDeps } from '../../../bot-teams/bot-team-version-deps'
import {
  botTeamFileVersions,
  botTeamLastVersionOfFile,
  readBotTeamVersionFile
} from '../../../bot-teams/bot-team-version-read'
import { restoreBotTeamFile } from '../../../bot-teams/bot-team-version-restore'
import { defineMethod } from '../core'

/** A store that cannot be read is 'unavailable', so the screens leave versions out. */
async function readVersions(teamId: string): Promise<BotTeamVersionsResult> {
  try {
    const deps = botTeamVersionDeps(teamId)
    // A team whose first task has not started has no folder, and so nothing to save.
    if (!existsSync(deps.folder)) {
      return { git: 'ok', versions: [], lastVersionOfFile: {} }
    }
    const versions = await listBotTeamVersions(deps)
    return {
      git: 'ok',
      versions,
      lastVersionOfFile: versions.length === 0 ? {} : await botTeamLastVersionOfFile(deps)
    }
  } catch (error) {
    console.warn('[bot-teams] could not read the versions store', error)
    return { git: 'unavailable' }
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
