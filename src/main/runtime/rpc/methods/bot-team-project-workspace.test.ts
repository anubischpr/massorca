import { afterEach, describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { SCHEMA_VERSION } from '../../orchestration/db/contract-constants'
import { OrchestrationDb } from '../../orchestration/db/orchestration-db'
import { migrateV56 } from '../../orchestration/db/schema/migrate-v56'
import type { RpcContext } from '../core'
import {
  botTeamListLinkableWorkspacesMethod,
  botTeamSetProjectWorkspaceMethod,
  linkableWorkspaceExists,
  listBotTeamLinkableWorkspaces,
  type LinkableWorkspaceSource
} from './bot-team-project-workspace'

/** Why: a fixture sets only the fields the listing reads; the rest of the record is never touched. */
function fixture<T>(fields: Partial<T>): T {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the listing reads only the fields a fixture sets.
  return fields as T
}

const TEAMS_FOLDER = '/Users/iris/MassOrca Bot Teams'

function sourceOf(options: {
  repos?: { id: string; kind: 'git' | 'folder' }[]
  rows?: Partial<Worktree>[]
  folders?: Partial<FolderWorkspace>[]
}): LinkableWorkspaceSource {
  return {
    listRepos: () => options.repos ?? [],
    listWorktreeRows: async () => (options.rows ?? []).map((row) => fixture<Worktree>(row)),
    listFolderWorkspaces: () =>
      (options.folders ?? []).map((folder) => fixture<FolderWorkspace>(folder))
  }
}

const HOST_OPTIONS = {
  repos: [
    { id: 'repo-1', kind: 'git' as const },
    { id: 'repo-2', kind: 'folder' as const }
  ],
  rows: [
    {
      id: 'repo-1::/work/nexus',
      repoId: 'repo-1',
      path: '/work/nexus',
      displayName: 'nexus'
    },
    {
      id: 'repo-1::/work/nexus-fix',
      repoId: 'repo-1',
      path: '/work/nexus-fix',
      displayName: 'nexus-fix',
      manualDisplayName: '  NexusCare fix  '
    },
    // Why: a folder workspace can also reach the listing as a worktree row; it is listed once.
    {
      id: 'folder:fw-1',
      repoId: 'folder-workspace:group-1',
      path: '/notes/notes',
      displayName: 'Notes'
    },
    {
      id: 'repo-2::/notes/legacy',
      repoId: 'repo-2',
      path: '/notes/legacy',
      displayName: 'Legacy'
    },
    {
      id: `repo-1::${TEAMS_FOLDER}/team-1`,
      repoId: 'repo-1',
      path: `${TEAMS_FOLDER}/team-1`,
      displayName: 'Marketing'
    }
  ],
  folders: [
    { id: 'fw-1', projectGroupId: 'group-1', name: 'Notes', folderPath: '/notes/notes' },
    { id: 'fw-2', projectGroupId: 'group-1', name: 'Clinic', folderPath: '/notes/clinic' },
    {
      id: 'fw-team',
      projectGroupId: 'group-1',
      name: 'Marketing',
      folderPath: `${TEAMS_FOLDER}/team-2`
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

  function ctxFor(options: Parameters<typeof sourceOf>[0]): RpcContext {
    const source = sourceOf(options)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the methods read only these runtime calls.
    return {
      runtime: {
        getOrchestrationDb: () => db,
        listRepos: source.listRepos,
        listManagedWorktrees: async () => ({
          worktrees: await source.listWorktreeRows(),
          totalCount: 0,
          truncated: false
        }),
        listFolderWorkspaces: source.listFolderWorkspaces
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

  it('lists git worktrees and folder workspaces by name, without the teams’ own folders', async () => {
    const workspaces = await listBotTeamLinkableWorkspaces(sourceOf(HOST_OPTIONS))

    expect(workspaces).toHaveLength(5)
    expect(workspaces).toEqual(
      expect.arrayContaining([
        { key: 'worktree:repo-1::/work/nexus', name: 'nexus', kind: 'git' },
        { key: 'worktree:repo-1::/work/nexus-fix', name: 'NexusCare fix', kind: 'git' },
        { key: 'folder:fw-1', name: 'Notes', kind: 'folder' },
        { key: 'folder:fw-2', name: 'Clinic', kind: 'folder' },
        { key: 'worktree:repo-2::/notes/legacy', name: 'Legacy', kind: 'folder' }
      ])
    )
    expect(workspaces.map((entry) => entry.key)).not.toContain('folder:fw-team')
    expect(workspaces.map((entry) => entry.name)).not.toContain('Marketing')
  })

  it('refuses to list for a team with Workspaces off, with the sentence the screens show', async () => {
    db = openDb()
    const { team } = seedTeam(db, false)
    const ctx = ctxFor(HOST_OPTIONS)

    await expect(
      botTeamListLinkableWorkspacesMethod.handler({ teamId: team.id }, ctx)
    ).rejects.toThrow('Turn on Workspaces for Marketing to link a Workspaces project.')
  })

  it('links a project to a listed workspace, keeps its name, and clears the link', async () => {
    db = openDb()
    const { team, project } = seedTeam(db, true)
    const ctx = ctxFor(HOST_OPTIONS)

    const listed = await botTeamListLinkableWorkspacesMethod.handler({ teamId: team.id }, ctx)
    expect(listed.workspaces).toContainEqual({
      key: 'folder:fw-1',
      name: 'Notes',
      kind: 'folder'
    })

    const linked = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: 'folder:fw-1' },
      ctx
    )
    expect(linked.project.workspace).toEqual({ key: 'folder:fw-1', name: 'Notes' })

    const cleared = await botTeamSetProjectWorkspaceMethod.handler(
      { projectId: project.id, workspaceKey: null },
      ctx
    )
    expect(cleared.project.workspace).toBeNull()
  })

  it('refuses a link for a team with Workspaces off, but still lets a link be cleared', async () => {
    db = openDb()
    const { team, project } = seedTeam(db, true)
    db.setBotTeamProjectWorkspace(project.id, { key: 'folder:fw-1', name: 'Notes' })
    db.updateBotTeam({ teamId: team.id, workspacesEnabled: false })
    const ctx = ctxFor(HOST_OPTIONS)

    await expect(
      botTeamSetProjectWorkspaceMethod.handler(
        { projectId: project.id, workspaceKey: 'folder:fw-2' },
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
    const ctx = ctxFor(HOST_OPTIONS)

    await expect(
      botTeamSetProjectWorkspaceMethod.handler(
        { projectId: project.id, workspaceKey: 'folder:fw-team' },
        ctx
      )
    ).rejects.toThrow('That workspace is not on this host. Pick another one.')
  })

  it('tells whether a stored workspace key still names a workspace on the host', async () => {
    const source = sourceOf(HOST_OPTIONS)

    await expect(linkableWorkspaceExists(source, 'folder:fw-1')).resolves.toBe(true)
    await expect(linkableWorkspaceExists(source, 'folder:fw-gone')).resolves.toBe(false)
  })
})
