import { ipcMain } from 'electron'
import { appStarSourceSchema } from '../../shared/gh-star-source'
import { githubHostFromIdentityKey } from '../../shared/github/repository-identity-key'
import { diagnoseGhAuth } from '../github/auth-diagnose'
import { checkOrcaStarred, getAuthenticatedViewer, starOrca } from '../github/client'
import {
  listGhAccountBindingInventory,
  validateGhAccountBinding
} from '../github/gh-account-binding-inventory'
import {
  applyGhAccountGitConfig,
  readRepoGhAccountGitConfig
} from '../github/gh-account-git-config'
import { getRateLimit } from '../github/rate-limit'
import type { Store } from '../persistence'
import { getCohortAtEmit } from '../telemetry/cohort-classifier'
import { track } from '../telemetry/client'
import { assertRegisteredGitHubRepo, getGitHubLocalGitOptionArgs } from './github-repo-routing'

export function registerGitHubAccountHandlers(store: Store): void {
  ipcMain.handle('gh:viewer', () => getAuthenticatedViewer())
  ipcMain.handle('gh:checkOrcaStarred', () => checkOrcaStarred())
  ipcMain.handle('gh:starOrca', async (_event, source: unknown) => {
    const sourceParse = appStarSourceSchema.safeParse(source)
    const starred = await starOrca()
    if (starred && sourceParse.success) {
      track('app_starred_orca', {
        source: sourceParse.data,
        ...getCohortAtEmit()
      })
    }
    return starred
  })

  ipcMain.handle('gh:rateLimit', (_event, args?: { force?: boolean }) =>
    getRateLimit(args?.force ? { force: true } : undefined)
  )

  ipcMain.handle('gh:diagnoseAuth', (_event, args?: { host?: string }) =>
    diagnoseGhAuth(args?.host)
  )

  ipcMain.handle(
    'gh:listBindableAccounts',
    (_event, args: { repoPath: string; repoId?: string; refreshCapability?: boolean }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      const requiredHost = githubHostFromIdentityKey(repo.gitRemoteIdentity?.canonicalKey)
      return listGhAccountBindingInventory(getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}, {
        refreshCapability: args.refreshCapability === true,
        ...(requiredHost ? { requiredHost } : {})
      })
    }
  )

  ipcMain.handle(
    'gh:validateAccountBinding',
    (_event, args: { repoPath: string; repoId?: string; host: string; user: string }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      const requiredHost = githubHostFromIdentityKey(repo.gitRemoteIdentity?.canonicalKey)
      return validateGhAccountBinding(
        { host: args.host, user: args.user },
        getGitHubLocalGitOptionArgs(store, repo)[0] ?? {},
        requiredHost ? { requiredHost } : {}
      )
    }
  )

  ipcMain.handle(
    'gh:applyAccountGitConfig',
    (
      _event,
      args: {
        repoPath: string
        repoId?: string
        next: { host: string; user: string } | null
        previous: { host: string; user: string } | null
        setIdentity: boolean
      }
    ) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      return applyGhAccountGitConfig(
        repo,
        { next: args.next, previous: args.previous, setIdentity: args.setIdentity },
        getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}
      )
    }
  )

  ipcMain.handle(
    'gh:readAccountGitConfig',
    (_event, args: { repoPath: string; repoId?: string }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      return readRepoGhAccountGitConfig(repo, getGitHubLocalGitOptionArgs(store, repo)[0] ?? {})
    }
  )
}
