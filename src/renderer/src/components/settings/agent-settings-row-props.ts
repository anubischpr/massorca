import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { getAgentDisplayLabel, type AgentCatalogEntry } from '@/lib/agent-catalog'
import type { PiDisplayRuntime } from '@/lib/pi-agent-display'
import { useAppStore } from '@/store'
import {
  getTuiAgentDefaultArgs,
  getTuiAgentDefaultEnv,
  resolveTuiAgentLaunchArgs,
  resolveTuiAgentLaunchEnv
} from '../../../../shared/tui-agent-launch-defaults'
import {
  isTuiAgentEnabled,
  normalizeDisabledTuiAgents
} from '../../../../shared/tui-agent-selection'
import { createAgentAvailabilityUpdateQueue } from './agent-availability-settings'
import type { AgentCatalogRowProps } from './AgentCatalogRow'
import { buildCodexSessionSourceHomeControl } from './codex-session-source-home-control'

/** One queue for every surface that writes the agent availability list, so writes never race. */
export const enqueueAgentAvailabilityUpdate = createAgentAvailabilityUpdateQueue()

export type AgentRowSettingsContext = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void | Promise<void>
  piRuntime: PiDisplayRuntime
}

/** The per-agent row props read from global settings; shared by Settings > Agents and the Marketplace agent page. */
export function buildAgentCatalogRowProps(
  agent: AgentCatalogEntry,
  isDetected: boolean,
  { settings, updateSettings, piRuntime }: AgentRowSettingsContext
): AgentCatalogRowProps {
  const defaultAgent = settings.defaultTuiAgent
  const cmdOverrides = settings.agentCmdOverrides ?? {}
  const agentDefaultArgs = settings.agentDefaultArgs ?? {}
  const agentDefaultEnv = settings.agentDefaultEnv ?? {}
  const disabledAgents = normalizeDisabledTuiAgents(settings.disabledTuiAgents)
  const setAgentEnabled = (enabled: boolean): void => {
    void enqueueAgentAvailabilityUpdate({
      getSettings: () => useAppStore.getState().settings,
      fallbackSettings: settings,
      updateSettings,
      agentId: agent.id,
      enabled
    })
  }

  return {
    agentId: agent.id,
    label: getAgentDisplayLabel(agent.id, piRuntime),
    homepageUrl: agent.homepageUrl,
    defaultCmd: agent.cmd,
    defaultArgs: getTuiAgentDefaultArgs(agent.id),
    defaultEnv: getTuiAgentDefaultEnv(agent.id),
    isDetected,
    isEnabled: isTuiAgentEnabled(agent.id, disabledAgents),
    isDefault: isDetected && defaultAgent === agent.id,
    cmdOverride: isDetected ? cmdOverrides[agent.id] : undefined,
    argsOverride: resolveTuiAgentLaunchArgs(agent.id, agentDefaultArgs),
    envOverride: resolveTuiAgentLaunchEnv(agent.id, agentDefaultEnv),
    onSetDefault: isDetected ? () => updateSettings({ defaultTuiAgent: agent.id }) : () => {},
    onSetEnabled: setAgentEnabled,
    onSaveOverride: isDetected
      ? (value) => {
          const next = { ...cmdOverrides }
          if (value) {
            next[agent.id] = value
          } else {
            delete next[agent.id]
          }
          updateSettings({ agentCmdOverrides: next })
        }
      : () => {},
    onSaveArgs: (value) =>
      updateSettings({ agentDefaultArgs: { ...agentDefaultArgs, [agent.id]: value } }),
    onSaveEnv: (value) =>
      updateSettings({ agentDefaultEnv: { ...agentDefaultEnv, [agent.id]: value } }),
    sessionSourceHome:
      isDetected && agent.id === 'codex'
        ? buildCodexSessionSourceHomeControl(settings, updateSettings)
        : undefined
  }
}
