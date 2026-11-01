import { Folder, GitBranch, MessageSquare, Monitor, Shield, ShieldAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { nativeChatAccessTone } from '../native-chat/native-chat-access-mode-tone'
import { CreateChatChipMenu, type CreateChatMenuGroup } from './CreateChatChipMenu'
import {
  buildAccessMenuItems,
  buildLocationMenuItems,
  buildProjectMenuItems,
  buildWorkspaceModeMenuItems,
  findAccessMode,
  findWorkspaceMode,
  projectFromMenuValue,
  projectMenuValue
} from './create-chat-menu-items'
import { buildExistingWorktreeMenuItems } from './create-chat-worktree-menu-items'
import {
  canUseProjectless,
  chooseCreateChatLocation,
  chooseCreateChatProject,
  findRepo,
  reposOnHost,
  type CreateChatOptions,
  type CreateChatSelection
} from './create-chat-selection'

type ChipProps = {
  selection: CreateChatSelection
  options: CreateChatOptions
  onSelectionChange: (next: CreateChatSelection) => void
}

/** Location, project and workspace mode: the row attached above the composer box. */
export function CreateChatPlaceChips(props: ChipProps): React.JSX.Element {
  return (
    <>
      <LocationChip {...props} />
      <ProjectChip {...props} />
      <WorkspaceModeChip {...props} />
    </>
  )
}

/** Permissions: the composer footer chip, beside the session view switch. */
export function CreateChatPermissionsChip(props: ChipProps): React.JSX.Element {
  return <PermissionsChip {...props} />
}

function LocationChip({ selection, options, onSelectionChange }: ChipProps): React.JSX.Element {
  const host = options.hosts.find((candidate) => candidate.id === selection.executionHostId)
  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.locationAria', 'Location')}
      label={host?.label ?? selection.executionHostId}
      icon={<Monitor className="size-3.5 shrink-0" />}
      groups={[
        {
          key: 'location',
          value: selection.executionHostId,
          items: buildLocationMenuItems(options.hosts),
          onValueChange: (value) => {
            const next = options.hosts.find((candidate) => candidate.id === value)
            if (next) {
              onSelectionChange(chooseCreateChatLocation(selection, next.id, options.repos))
            }
          }
        }
      ]}
    />
  )
}

function ProjectChip({ selection, options, onSelectionChange }: ChipProps): React.JSX.Element {
  const repo = findRepo(options.repos, selection.project)
  // Why: a projectless chat on a remote location is not a valid state, so it reads as "choose a project".
  const projectless =
    selection.project.kind === 'none' && canUseProjectless(selection.executionHostId)
  const label = projectless
    ? translate('components.createChat.projectChipStandalone', 'Standalone chat')
    : (repo?.displayName ??
      translate('components.createChat.projectChipChoose', 'Choose a project'))
  const hostRepos = reposOnHost(options.repos, selection.executionHostId)
  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.projectAria', 'Project')}
      label={label}
      icon={
        projectless ? (
          <MessageSquare className="size-3.5 shrink-0" />
        ) : (
          <Folder className="size-3.5 shrink-0" />
        )
      }
      tone={projectless ? 'accent' : 'neutral'}
      note={
        hostRepos.length === 0
          ? translate('components.createChat.projectNoRepos', 'No projects on this location yet.')
          : undefined
      }
      groups={[
        {
          key: 'project',
          value: projectMenuValue(selection.project),
          items: buildProjectMenuItems({
            repos: options.repos,
            hostId: selection.executionHostId,
            projectlessDirectory: options.projectlessDirectory
          }),
          onValueChange: (value) => {
            const project = projectFromMenuValue(value, options.repos)
            if (project) {
              onSelectionChange(chooseCreateChatProject(selection, project))
            }
          }
        }
      ]}
    />
  )
}

function WorkspaceModeChip({
  selection,
  options,
  onSelectionChange
}: ChipProps): React.JSX.Element | null {
  if (selection.project.kind === 'none') {
    return null
  }
  const isFolder = findRepo(options.repos, selection.project)?.isFolder === true
  const modeItems = buildWorkspaceModeMenuItems(isFolder)
  const repoId = selection.project.repoId
  const worktrees = (options.worktrees ?? []).filter(
    (worktree) => worktree.repoId === repoId && worktree.hostId === selection.executionHostId
  )
  const picked = worktrees.find((worktree) => worktree.worktreeId === selection.existingWorktreeId)
  const current = modeItems.find((item) => item.value === selection.workspaceMode)
  const groups: CreateChatMenuGroup[] = [
    {
      key: 'workspace',
      value: picked ? '' : selection.workspaceMode,
      items: modeItems,
      onValueChange: (value) => {
        const workspaceMode = findWorkspaceMode(value)
        if (workspaceMode) {
          onSelectionChange({ ...selection, workspaceMode, existingWorktreeId: undefined })
        }
      }
    }
  ]
  const existingItems = buildExistingWorktreeMenuItems(worktrees)
  if (existingItems.length > 0) {
    groups.push({
      key: 'existing-worktrees',
      title: translate('components.createChat.existingWorktrees', 'Existing worktrees'),
      value: picked?.worktreeId ?? '',
      items: existingItems,
      onValueChange: (worktreeId) => {
        onSelectionChange({
          ...selection,
          workspaceMode: 'existing-worktree',
          existingWorktreeId: worktreeId
        })
      }
    })
  }
  const label = isFolder
    ? translate('components.createChat.workspaceNoGit', 'No Git')
    : (picked?.branch ??
      current?.label ??
      translate('components.createChat.workspaceExistingFallback', 'Existing worktree'))
  // Why: a folder has no worktrees to choose, so its chip is disabled rather than opening an empty menu.
  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.workspaceAria', 'Workspace mode')}
      label={label}
      icon={<GitBranch className="size-3.5 shrink-0" />}
      disabled={isFolder}
      groups={groups}
    />
  )
}

function PermissionsChip({ selection, onSelectionChange }: ChipProps): React.JSX.Element {
  const items = buildAccessMenuItems()
  const current = items.find((item) => item.value === selection.accessMode)
  const tone = nativeChatAccessTone(selection.accessMode, undefined)
  const Icon = tone === 'warning' ? ShieldAlert : Shield
  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.accessAria', 'Permissions')}
      label={current?.label ?? selection.accessMode}
      icon={<Icon className="size-3.5 shrink-0" />}
      tone={tone === 'warning' ? 'warning' : 'neutral'}
      groups={[
        {
          key: 'access',
          value: selection.accessMode,
          items,
          onValueChange: (value) => {
            const accessMode = findAccessMode(value)
            if (accessMode) {
              onSelectionChange({ ...selection, accessMode })
            }
          }
        }
      ]}
    />
  )
}
