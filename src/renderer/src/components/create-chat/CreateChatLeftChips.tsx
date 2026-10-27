import { Folder, GitBranch, MessageSquare, Monitor, Shield, ShieldAlert } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { nativeChatAccessTone } from '../native-chat/native-chat-access-mode-tone'
import { CreateChatChipMenu } from './CreateChatChipMenu'
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
import {
  canUseProjectless,
  chooseCreateChatLocation,
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

/** Location, project, workspace mode and permissions: the chips on the composer's left. */
export function CreateChatLeftChips(props: ChipProps): React.JSX.Element {
  return (
    <>
      <LocationChip {...props} />
      <ProjectChip {...props} />
      <WorkspaceModeChip {...props} />
      <PermissionsChip {...props} />
    </>
  )
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
              onSelectionChange({ ...selection, project })
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
  const items = buildWorkspaceModeMenuItems(isFolder)
  const current = items.find((item) => item.value === selection.workspaceMode)
  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.workspaceAria', 'Workspace mode')}
      label={
        isFolder
          ? translate('components.createChat.workspaceNoGit', 'No Git')
          : (current?.label ?? selection.workspaceMode)
      }
      icon={<GitBranch className="size-3.5 shrink-0" />}
      note={
        isFolder
          ? translate(
              'components.createChat.workspaceNoGitNote',
              'This folder is not a Git repository, so there is no branch to isolate.'
            )
          : undefined
      }
      groups={[
        {
          key: 'workspace',
          value: selection.workspaceMode,
          items,
          onValueChange: (value) => {
            const workspaceMode = findWorkspaceMode(value)
            if (workspaceMode) {
              onSelectionChange({ ...selection, workspaceMode })
            }
          }
        }
      ]}
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
