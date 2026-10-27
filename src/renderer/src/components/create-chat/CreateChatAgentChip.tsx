import { translate } from '@/i18n/i18n'
import { AgentIcon, getAgentCatalog } from '@/lib/agent-catalog'
import type { AgentSessionModelOption } from '../../../../shared/agent-session-wire'
import { nativeChatSessionChoiceLabel } from '../native-chat/native-chat-session-option-labels'
import { CreateChatChipMenu, type CreateChatMenuGroup } from './CreateChatChipMenu'
import {
  DEFAULT_MODEL_MENU_VALUE,
  buildAgentMenuItems,
  buildEffortMenuItems,
  buildModelMenuItems
} from './create-chat-menu-items'
import type { CreateChatOptions, CreateChatSelection } from './create-chat-selection'

type AgentChipProps = {
  selection: CreateChatSelection
  options: CreateChatOptions
  models: readonly AgentSessionModelOption[]
  onSelectionChange: (next: CreateChatSelection) => void
}

/** The agent, with the model and effort it launches with, as one chip. */
export function CreateChatAgentChip({
  selection,
  options,
  models,
  onSelectionChange
}: AgentChipProps): React.JSX.Element {
  const agentLabel =
    getAgentCatalog().find((entry) => entry.id === selection.agent)?.label ?? selection.agent
  const activeModel =
    models.find((model) => model.id === selection.model) ??
    models.find((model) => model.isDefault) ??
    models[0]
  const efforts = activeModel?.efforts ?? []
  const modelLabel = selection.model
    ? models.find((model) => model.id === selection.model)?.label
    : undefined
  const effortValue = selection.effort ?? activeModel?.defaultEffort
  const effortLabel = efforts.find((effort) => effort.value === effortValue)
  const label = [
    agentLabel,
    modelLabel,
    effortLabel ? nativeChatSessionChoiceLabel(effortLabel) : undefined
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ')

  const groups: CreateChatMenuGroup[] = [
    {
      key: 'agent',
      title: translate('components.createChat.agentGroup', 'Agent'),
      value: selection.agent,
      items: buildAgentMenuItems(options.agents),
      onValueChange: (value) => {
        const agent = options.agents.find((candidate) => candidate === value)
        if (agent) {
          onSelectionChange({ ...selection, agent, model: undefined, effort: undefined })
        }
      }
    }
  ]
  if (models.length > 0) {
    groups.push({
      key: 'model',
      title: translate('components.createChat.modelGroup', 'Model'),
      value: selection.model ?? DEFAULT_MODEL_MENU_VALUE,
      items: buildModelMenuItems(models),
      onValueChange: (value) => {
        const next = models.find((model) => model.id === value)
        onSelectionChange({
          ...selection,
          model: next?.id,
          effort: undefined
        })
      }
    })
  }
  if (efforts.length > 0) {
    groups.push({
      key: 'effort',
      title: translate('components.createChat.effortGroup', 'Effort'),
      value: effortValue ?? '',
      items: buildEffortMenuItems(efforts),
      onValueChange: (value) => {
        const effort = efforts.find((candidate) => candidate.value === value)
        if (effort) {
          onSelectionChange({ ...selection, effort: effort.value })
        }
      }
    })
  }

  return (
    <CreateChatChipMenu
      ariaLabel={translate('components.createChat.agentAria', 'Agent, model and effort')}
      label={label}
      icon={<AgentIcon agent={selection.agent} size={14} />}
      note={
        options.agents.length === 0
          ? translate('components.createChat.noAgents', 'No agents detected yet.')
          : undefined
      }
      groups={groups}
    />
  )
}
