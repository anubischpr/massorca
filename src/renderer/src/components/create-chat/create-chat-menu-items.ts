import type {
  AgentSessionModelOption,
  AgentSessionOptionChoice
} from '../../../../shared/agent-session-wire'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { nativeChatSessionChoiceLabel } from '../native-chat/native-chat-session-option-labels'
import {
  CREATE_CHAT_ACCESS_MODES,
  CREATE_CHAT_WORKSPACE_MODES,
  canUseProjectless,
  reposOnHost,
  type CreateChatAccessMode,
  type CreateChatHostOption,
  type CreateChatProject,
  type CreateChatRepoOption,
  type CreateChatWorkspaceMode
} from './create-chat-selection'

export type CreateChatMenuItem = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export const PROJECTLESS_PROJECT_VALUE = 'projectless'
export const DEFAULT_MODEL_MENU_VALUE = '__default_model__'
const REPO_PROJECT_VALUE_PREFIX = 'repo:'

export function projectMenuValue(project: CreateChatProject): string {
  return project.kind === 'none'
    ? PROJECTLESS_PROJECT_VALUE
    : `${REPO_PROJECT_VALUE_PREFIX}${project.repoId}`
}

/** Maps a menu value back to a project; null when the value names no current option. */
export function projectFromMenuValue(
  value: string,
  repos: readonly CreateChatRepoOption[]
): CreateChatProject | null {
  if (value === PROJECTLESS_PROJECT_VALUE) {
    return { kind: 'none' }
  }
  const repo = repos.find(
    (candidate) => `${REPO_PROJECT_VALUE_PREFIX}${candidate.repoId}` === value
  )
  return repo ? { kind: 'repo', repoId: repo.repoId } : null
}

export function findWorkspaceMode(value: string): CreateChatWorkspaceMode | null {
  return CREATE_CHAT_WORKSPACE_MODES.find((mode) => mode === value) ?? null
}

export function findAccessMode(value: string): CreateChatAccessMode | null {
  return CREATE_CHAT_ACCESS_MODES.find((mode) => mode === value) ?? null
}

export function buildLocationMenuItems(
  hosts: readonly CreateChatHostOption[]
): CreateChatMenuItem[] {
  return hosts.map((host) => ({ value: host.id, label: host.label, description: host.detail }))
}

export function buildProjectMenuItems({
  repos,
  hostId,
  projectlessDirectory
}: {
  repos: readonly CreateChatRepoOption[]
  hostId: ExecutionHostId
  projectlessDirectory: string
}): CreateChatMenuItem[] {
  const projectlessAllowed = canUseProjectless(hostId)
  const projectless: CreateChatMenuItem = {
    value: PROJECTLESS_PROJECT_VALUE,
    label: translate('components.createChat.projectNone', 'Work without a project'),
    description: projectlessAllowed
      ? translate(
          'components.createChat.projectlessDescription',
          'Standalone chat, saved by date in {{directory}}',
          { directory: projectlessDirectory }
        )
      : translate(
          'components.createChat.projectlessUnavailable',
          'Only available on this computer'
        ),
    disabled: !projectlessAllowed
  }
  const hostRepos = reposOnHost(repos, hostId).map((repo) => ({
    value: `${REPO_PROJECT_VALUE_PREFIX}${repo.repoId}`,
    label: repo.displayName,
    description: repo.path
  }))
  return [projectless, ...hostRepos]
}

export function buildWorkspaceModeMenuItems(isFolder: boolean): CreateChatMenuItem[] {
  return [
    {
      value: 'new-worktree',
      label: translate('components.createChat.workspaceNewWorktree', 'New worktree'),
      description: translate(
        'components.createChat.workspaceNewWorktreeDescription',
        'Isolated branch created from the base branch'
      ),
      disabled: isFolder
    },
    {
      value: 'current-checkout',
      label: translate('components.createChat.workspaceCurrentCheckout', 'Current checkout'),
      description: translate(
        'components.createChat.workspaceCurrentCheckoutDescription',
        'Work directly on the open branch'
      ),
      disabled: isFolder
    }
  ]
}

export function buildAccessMenuItems(): CreateChatMenuItem[] {
  return CREATE_CHAT_ACCESS_MODES.map((mode) => ({
    value: mode,
    label: nativeChatSessionChoiceLabel({ value: mode, label: mode }),
    description: accessModeDescription(mode)
  }))
}

function accessModeDescription(mode: CreateChatAccessMode): string {
  switch (mode) {
    case 'default':
      return translate(
        'components.createChat.accessDefaultDescription',
        'Ask before each edit or command.'
      )
    case 'accept-edits':
      return translate(
        'components.createChat.accessAcceptEditsDescription',
        'Apply file edits without asking. Commands still ask.'
      )
    case 'plan':
      return translate(
        'components.createChat.accessPlanDescription',
        'Plan only. No edits or commands run.'
      )
    case 'full-access':
      return translate(
        'components.createChat.accessFullAccessDescription',
        'Skip permission prompts. Use only in trusted projects.'
      )
  }
}

export function buildAgentMenuItems(agents: readonly TuiAgent[]): CreateChatMenuItem[] {
  const catalog = getAgentCatalog()
  return agents.map((agent) => ({
    value: agent,
    label: catalog.find((entry) => entry.id === agent)?.label ?? agent
  }))
}

export function buildModelMenuItems(
  models: readonly AgentSessionModelOption[]
): CreateChatMenuItem[] {
  return [
    {
      value: DEFAULT_MODEL_MENU_VALUE,
      label: translate('components.createChat.defaultModel', 'Default model')
    },
    ...models.map((model) => ({
      value: model.id,
      label: model.label,
      ...(model.description ? { description: model.description } : {})
    }))
  ]
}

export function buildEffortMenuItems(
  efforts: readonly AgentSessionOptionChoice[]
): CreateChatMenuItem[] {
  return efforts.map((effort) => ({
    value: effort.value,
    label: nativeChatSessionChoiceLabel(effort),
    ...(effort.description ? { description: effort.description } : {})
  }))
}
