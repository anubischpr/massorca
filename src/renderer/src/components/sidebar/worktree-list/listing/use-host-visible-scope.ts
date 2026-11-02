import { useMemo } from 'react'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import { isBotTeamFolderShown } from '../../../../../../shared/bot-team-folder'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import { useBotTeamWorkspaceIds } from '../../../bot-teams/use-bot-teams'
import type { Repo } from '../../../../../../shared/repo-types'
import {
  getRepoExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host'
import type { SidebarWorktreeFilters } from './use-filters'
import { filterFolderWorkspacesFromOtherDevices } from '../../workspace-creator-visibility'
import {
  filterFolderWorkspacesForVisibleHosts,
  filterProjectGroupsForVisibleHosts,
  getVisibleSidebarHostIdSet
} from './host-filtering'

// Narrows repos, project groups, and folder workspaces to the hosts (and devices) the
// current host filter admits.
export function useSidebarHostVisibleScope(args: {
  filterState: SidebarWorktreeFilters['filterState']
  defaultHostId: ExecutionHostId
  repos: readonly Repo[]
  projectGroups: readonly ProjectGroup[]
  folderWorkspaces: readonly FolderWorkspace[]
  pairedDeviceIdsByEnvironment: Parameters<typeof filterFolderWorkspacesFromOtherDevices>[1]
}) {
  const { filterState, defaultHostId, repos, projectGroups, folderWorkspaces } = args
  const { visibleWorkspaceHostIds, workspaceHostScope, hideWorkspacesFromOtherDevices } =
    filterState
  const visibleHostIdSet = useMemo(
    () => getVisibleSidebarHostIdSet(visibleWorkspaceHostIds, workspaceHostScope),
    [visibleWorkspaceHostIds, workspaceHostScope]
  )
  const visibleReposForRows = useMemo(() => {
    if (!visibleHostIdSet) {
      return repos
    }
    return repos.filter((repo) => {
      const hostId =
        repo.connectionId || repo.executionHostId ? getRepoExecutionHostId(repo) : defaultHostId
      return visibleHostIdSet.has(hostId)
    })
  }, [defaultHostId, repos, visibleHostIdSet])
  const visibleProjectGroupsForRows = useMemo(
    () => filterProjectGroupsForVisibleHosts(projectGroups, visibleHostIdSet, defaultHostId),
    [defaultHostId, projectGroups, visibleHostIdSet]
  )
  const botTeamWorkspaceIds = useBotTeamWorkspaceIds()
  const visibleFolderWorkspacesForRows = useMemo(() => {
    const hostVisibleWorkspaces = filterFolderWorkspacesForVisibleHosts(
      folderWorkspaces.filter((folderWorkspace) =>
        isBotTeamFolderShown(folderWorkspace.folderPath, botTeamWorkspaceIds)
      ),
      projectGroups,
      visibleHostIdSet,
      defaultHostId
    )
    if (!hideWorkspacesFromOtherDevices) {
      return hostVisibleWorkspaces
    }
    return filterFolderWorkspacesFromOtherDevices(
      hostVisibleWorkspaces,
      args.pairedDeviceIdsByEnvironment
    )
  }, [
    args.pairedDeviceIdsByEnvironment,
    botTeamWorkspaceIds,
    defaultHostId,
    folderWorkspaces,
    hideWorkspacesFromOtherDevices,
    projectGroups,
    visibleHostIdSet
  ])

  return { visibleReposForRows, visibleProjectGroupsForRows, visibleFolderWorkspacesForRows }
}
