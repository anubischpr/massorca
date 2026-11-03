import { afterEach, describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { SCHEMA_VERSION } from '../../orchestration/db/contract-constants'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { migrateV56 } from '../../orchestration/db/schema/migrate-v56'
import type { RpcContext } from '../core'
import {
  botTeamListLinkableWorkspacesMethod,
  botTeamSetProjectWorkspaceMethod
} from './bot-team-project-workspace'

/** Why: a fixture sets only the fields the methods read; the rest of the record is never touched. */
function fixture<T>(fields: Partial<T>): T {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the methods read only the fields a fixture sets.
  return fields as T
}

type HostOptions = {
  repos: Partial<Repo>[]
  rows: Partial<Worktree>[]
  groups: Partial<ProjectGroup>[]
  folders: Partial<FolderWorkspace>[]
}

const HOST_OPTIONS: HostOptions = {
  repos: [
    {
      id: 'repo-1',
      kind: 'git',
      path: '/work/nexus',
      displayName: 'NexusCare',
      repoIcon: { type: 'emoji', emoji: '🩺' }
    },
    { id: 'repo-2', kind: 'folder', path: '/notes/legacy', displayName: 'Legacy' }
  ],
  rows: [
    { id: 'repo-1::/work/nexus', repoId: 'repo-1', path: '/work/nexus' },
    { id: 'repo-1::/work/nexus-fix', repoId: 'repo-1', path: '/work/nexus-fix' },
    { id: 'repo-2::/notes/legacy', repoId: 'repo-2', path: '/notes/legacy' }
  ],
  groups: [{ id: 'group-1', name: 'Clinics' }],
  folders: [
    {
      id: 'fw-1',
      projectGroupId: 'group-1',
      name: 'Notes',
      folderPath: '/clinics/notes',
      isArchived: false,
      lastActivityAt: 1
    }
  ]
}

describe('bot team project workspaces on the host', () => {
  let db: OrchestrationDb | undefined

  afterEach(() => {
    db?.close()
    db = undefined
  })

  function openDb(): OrchestrationDb {
    const open = new OrchestrationDb(':memory:')
    migrateV56.call(open, SCHEMA_VERSION)
    return open
  }

  function ctxFor(options: HostOptions): RpcContext {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the methods read only these runtime calls.
    return {
      runtime: {
        getOrchestrationDb: () => db,
        listRepos: () => options.repos.map((repo) => fixture<Repo>(repo)),
        listManagedWorktrees: async () => ({
          worktrees: options.rows.map((row) => fixture<Worktree>(row)),
          totalCount: 0,
          truncated: false
        }),
        listProjectGroups: () => options.groups.map((group) => fixture<ProjectGroup>(group)),
        listFolderWorkspaces: () =>
          options.folders.map((folder) => fixture<FolderWorkspace>(folder))
      }
    } as unknown as RpcContext
  }

  function seedTeam(open: OrchestrationDb, workspacesEnabled: boolean) {
    const team = open.createBotTeam({
      name: 'Marketing',
      purpose: '',
      character: 'circle',
      workspacesEnabled,
      bots: [{ name: 'Iris', job: '', agent: 'claude' }]
    })
    const project = open.createBotTeamProject({
      teamId: team.id,
      name: 'NexusCare',
      goal: '',
      codeSource: 'repo'
    })
    return { team, project }
  }

  it('lists the repos and folder projects, with their icon, and not their worktrees', async () => {
    db = openDb()
    const { team } = seedTeam(db, true)

    const listed = await botTeamListLinkableWorkspacesMethod.handler(
      { teamId: team.id },
      ctxFor(HOST_OPTIONS)
    )

    expect(listed.workspaces).toEqual([
      { key: 'group:group-1', name: 'Clinics', kind: 'folder' },
      { key: 'repo:repo-2', name: 'Legacy', kind: 'folder' },
      { key: 'repo:repo-1', name: 'NexusCare', kind: 'git', icon: { type: 'emoji', emoji: '🩺' } }
    ])
  })

  it('refuses to list for a team with Workspaces off, with the sentence the screens show', async () => {
    db = openDb()
    const { team } = seedTeam(db, false)

    await expect(
      botTeamListLinkableWorkspacesMethod.handler({ teamId: team.id }, ctxFor(HOST_OPTIONS))
    ).rejects.toThrow('Turn on Workspaces for Marketing to link a Workspaces project.')
  })

  it('links a project to the repo itself, keeps its name, and clears the link', async () => {
    db = openDb()
    const { project } = seedTeam(db, true)
    const ctx = ctxFor(HOST_OPTIONS)

    const linked = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: 'repo:repo-1' },
      ctx
    )
    expect(linked.project.workspace).toEqual({ key: 'repo:repo-1', name: 'NexusCare' })

    const cleared = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: null },
      ctx
    )
    expect(cleared.project.workspace).toBeNull()
  })

  it('stores the repo when a worktree of it is chosen', async () => {
    db = openDb()
    const { project } = seedTeam(db, true)

    const linked = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: 'worktree:repo-1::/work/nexus-fix' },
      ctxFor(HOST_OPTIONS)
    )

    expect(linked.project.workspace).toEqual({ key: 'repo:repo-1', name: 'NexusCare' })
  })

  it('rewrites an old link to a worktree as its repo when the picker opens', async () => {
    db = openDb()
    const { team, project } = seedTeam(db, true)
    db.setBotTeamProjectWorkspace(project.id, {
      key: 'worktree:repo-1::/work/nexus-fix',
      name: 'nexus-fix'
    })

    await botTeamListLinkableWorkspacesMethod.handler({ teamId: team.id }, ctxFor(HOST_OPTIONS))

    expect(db.getBotTeamProject(project.id).workspace).toEqual({
      key: 'repo:repo-1',
      name: 'NexusCare'
    })
  })

  it('keeps an old link whose worktree is gone as it was', async () => {
    db = openDb()
    const { team, project } = seedTeam(db, true)
    const old = { key: 'worktree:repo-1::/work/gone', name: 'gone' }
    db.setBotTeamProjectWorkspace(project.id, old)

    await botTeamListLinkableWorkspacesMethod.handler({ teamId: team.id }, ctxFor(HOST_OPTIONS))

    expect(db.getBotTeamProject(project.id).workspace).toEqual(old)
  })

  it('refuses a link for a team with Workspaces off, but still lets a link be cleared', async () => {
    db = openDb()
    const { team, project } = seedTeam(db, true)
    db.setBotTeamProjectWorkspace(project.id, { key: 'repo:repo-1', name: 'NexusCare' })
    db.updateBotTeam({ teamId: team.id, workspacesEnabled: false })
    const ctx = ctxFor(HOST_OPTIONS)

    await expect(
      botTeamSetProjectWorkspaceMethod.handler(
        { projectId: project.id, workspaceKey: 'repo:repo-2' },
        ctx
      )
    ).rejects.toThrow('Turn on Workspaces for Marketing to link a Workspaces project.')

    const cleared = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: null },
      ctx
    )
    expect(cleared.project.workspace).toBeNull()
  })

  it('refuses a workspace the host does not list', async () => {
    db = openDb()
    const { project } = seedTeam(db, true)

    await expect(
      botTeamSetProjectWorkspaceMethod.handler(
        { projectId: project.id, workspaceKey: 'repo:repo-gone' },
        ctxFor(HOST_OPTIONS)
      )
    ).rejects.toThrow('That workspace is not on this host. Pick another one.')
  })
})
