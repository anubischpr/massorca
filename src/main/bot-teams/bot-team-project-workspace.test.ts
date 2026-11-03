import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { RepoIcon } from '../../shared/repo-icon'
import type { Repo } from '../../shared/repo-types'
import type { Worktree } from '../../shared/worktree/types'
import {
  findBotTeamWorkspaceProject,
  listBotTeamLinkableWorkspaces,
  type WorkspaceProjectSource
} from './bot-team-project-workspace'

/** Why: a fixture sets only the fields the listing reads; the rest of the record is never touched. */
function fixture<T>(fields: Partial<T>): T {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the listing reads only the fields a fixture sets.
  return fields as T
}

const TEAMS_FOLDER = '/Users/iris/MassOrca Bot Teams'
const NEXUS_ICON: RepoIcon = { type: 'emoji', emoji: '🩺' }

type Options = {
  repos?: Partial<Repo>[]
  rows?: Partial<Worktree>[]
  groups?: Partial<ProjectGroup>[]
  folders?: Partial<FolderWorkspace>[]
}

function sourceOf(options: Options): WorkspaceProjectSource {
  return {
    listRepos: () => (options.repos ?? []).map((repo) => fixture<Repo>(repo)),
    listWorktreeRows: async () => (options.rows ?? []).map((row) => fixture<Worktree>(row)),
    listProjectGroups: () => (options.groups ?? []).map((group) => fixture<ProjectGroup>(group)),
    listFolderWorkspaces: () =>
      (options.folders ?? []).map((folder) => fixture<FolderWorkspace>(folder))
  }
}

const HOST: Options = {
  repos: [
    {
      id: 'repo-1',
      kind: 'git',
      path: '/work/nexus',
      displayName: 'NexusCare',
      repoIcon: NEXUS_ICON
    },
    { id: 'repo-2', kind: 'folder', path: '/notes/legacy', displayName: 'Legacy' },
    { id: 'repo-3', kind: 'git', path: '/work/plain', displayName: 'Plain' },
    {
      id: 'repo-team',
      kind: 'git',
      path: `${TEAMS_FOLDER}/team-1`,
      displayName: 'Marketing'
    }
  ],
  rows: [
    { id: 'repo-1::/work/nexus', repoId: 'repo-1', path: '/work/nexus' },
    { id: 'repo-1::/work/nexus-fix', repoId: 'repo-1', path: '/work/nexus-fix' },
    { id: 'repo-1::/work/nexus-docs', repoId: 'repo-1', path: '/work/nexus-docs' },
    { id: 'repo-2::/notes/legacy', repoId: 'repo-2', path: '/notes/legacy' },
    { id: 'repo-3::/work/plain', repoId: 'repo-3', path: '/work/plain' },
    { id: 'folder:fw-1', repoId: 'folder-workspace:group-1', path: '/clinics/notes' }
  ],
  groups: [
    { id: 'group-1', name: 'Clinics' },
    { id: 'group-teams', name: 'MassOrca Bot Teams' }
  ],
  folders: [
    {
      id: 'fw-1',
      projectGroupId: 'group-1',
      name: 'Notes',
      folderPath: '/clinics/notes',
      isArchived: false,
      lastActivityAt: 10
    },
    {
      id: 'fw-2',
      projectGroupId: 'group-1',
      name: 'Billing',
      folderPath: '/clinics/billing',
      isArchived: false,
      lastActivityAt: 20
    },
    {
      id: 'fw-old',
      projectGroupId: 'group-1',
      name: 'Old',
      folderPath: '/clinics/old',
      isArchived: true,
      lastActivityAt: 99
    },
    {
      id: 'fw-team',
      projectGroupId: 'group-teams',
      name: 'Marketing',
      folderPath: `${TEAMS_FOLDER}/team-2`,
      isArchived: false,
      lastActivityAt: 5
    }
  ]
}

describe('Workspaces projects a bot project can link to', () => {
  it('lists each repo and folder project once, never one row per worktree', async () => {
    const listed = await listBotTeamLinkableWorkspaces(sourceOf(HOST))

    expect(listed.map((entry) => entry.name)).toEqual(['Clinics', 'Legacy', 'NexusCare', 'Plain'])
    expect(listed.map((entry) => entry.key)).toEqual([
      'group:group-1',
      'repo:repo-2',
      'repo:repo-1',
      'repo:repo-3'
    ])
    expect(listed.map((entry) => entry.kind)).toEqual(['folder', 'folder', 'git', 'git'])
  })

  it('leaves out the teams’ own folders and their group', async () => {
    const listed = await listBotTeamLinkableWorkspaces(sourceOf(HOST))

    expect(listed.map((entry) => entry.name)).not.toContain('Marketing')
    expect(listed.map((entry) => entry.name)).not.toContain('MassOrca Bot Teams')
  })

  it('gives each project the icon the sidebar shows for it, and none when it has none', async () => {
    const listed = await listBotTeamLinkableWorkspaces(sourceOf(HOST))

    expect(listed.find((entry) => entry.name === 'NexusCare')?.icon).toEqual(NEXUS_ICON)
    expect(listed.find((entry) => entry.name === 'Plain')).not.toHaveProperty('icon')
    expect(listed.find((entry) => entry.name === 'Clinics')).not.toHaveProperty('icon')
  })

  it('runs a git project in a child of its main checkout and a folder project in the folder', async () => {
    const source = sourceOf(HOST)

    expect((await findBotTeamWorkspaceProject(source, 'repo:repo-1'))?.home).toEqual({
      type: 'repo',
      repoId: 'repo-1',
      mainWorktreeId: 'repo-1::/work/nexus'
    })
    expect((await findBotTeamWorkspaceProject(source, 'repo:repo-2'))?.home).toEqual({
      type: 'folder',
      workspaceId: 'repo-2::/notes/legacy'
    })
    // The group's most recently used folder that is not archived.
    expect((await findBotTeamWorkspaceProject(source, 'group:group-1'))?.home).toEqual({
      type: 'folder',
      workspaceId: 'folder:fw-2'
    })
  })

  it('reads a link saved against a worktree as the repo it belongs to', async () => {
    const found = await findBotTeamWorkspaceProject(
      sourceOf(HOST),
      'worktree:repo-1::/work/nexus-fix'
    )

    expect(found?.entry).toMatchObject({ key: 'repo:repo-1', name: 'NexusCare' })
  })

  it('reads a link saved against a folder workspace as its folder project', async () => {
    const byWorkspace = await findBotTeamWorkspaceProject(sourceOf(HOST), 'folder:fw-1')
    const byRow = await findBotTeamWorkspaceProject(
      sourceOf(HOST),
      'worktree:repo-2::/notes/legacy'
    )

    expect(byWorkspace?.entry.key).toBe('group:group-1')
    expect(byRow?.entry.key).toBe('repo:repo-2')
  })

  it('finds nothing for a worktree that no longer exists, so the start can report it gone', async () => {
    const source = sourceOf(HOST)

    await expect(
      findBotTeamWorkspaceProject(source, 'worktree:repo-1::/work/gone')
    ).resolves.toBeNull()
    await expect(findBotTeamWorkspaceProject(source, 'repo:repo-gone')).resolves.toBeNull()
    await expect(findBotTeamWorkspaceProject(source, 'folder:fw-gone')).resolves.toBeNull()
  })
})
