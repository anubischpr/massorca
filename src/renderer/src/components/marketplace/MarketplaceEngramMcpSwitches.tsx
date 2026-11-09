import { useCallback, useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { translate } from '@/i18n/i18n'
import {
  MARKETPLACE_MCP_AGENTS,
  type MarketplaceDetection,
  type MarketplaceMcpAgent
} from '../../../../shared/marketplace-types'
import { marketplaceAgentLabel } from './marketplace-catalog'
import { MarketplaceInfoRow } from './MarketplaceInfoRow'

/** Engram's MCP server per agent on this computer, switched through the Marketplace bridge. */
export function MarketplaceEngramMcpSwitches(): React.JSX.Element | null {
  const [detection, setDetection] = useState<MarketplaceDetection | null>(null)
  const [pendingAgent, setPendingAgent] = useState<MarketplaceMcpAgent | null>(null)
  const [errors, setErrors] = useState<Partial<Record<MarketplaceMcpAgent, string>>>({})

  const load = useCallback(async (): Promise<void> => {
    try {
      setDetection(await window.api.marketplace.detect())
    } catch {
      setDetection(null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (agent: MarketplaceMcpAgent, enabled: boolean): Promise<void> => {
    setPendingAgent(agent)
    let failed = false
    try {
      const result = await window.api.marketplace.setEngramMcp({ agent, enabled })
      failed = !result.ok
    } catch {
      failed = true
    }
    setErrors((current) => ({
      ...current,
      [agent]: failed
        ? translate(
            'auto.components.marketplace.MarketplaceEngramMcpSwitches.changeFailed',
            "Could not change {{agent}}'s settings.",
            { agent: marketplaceAgentLabel(agent) }
          )
        : undefined
    }))
    setPendingAgent(null)
    await load()
  }

  if (detection === null) {
    return null
  }
  const programFound = detection.engram.cli === 'found'
  return (
    <div className="flex flex-col gap-4">
      {MARKETPLACE_MCP_AGENTS.map((agent) => {
        const state = detection.engram.agents[agent]
        const label = marketplaceAgentLabel(agent)
        return (
          <div key={agent} className="flex flex-col gap-1">
            <p className="text-sm font-medium">{label}</p>
            <MarketplaceInfoRow
              label={translate(
                'auto.components.marketplace.MarketplaceEngramMcpSwitches.mcpServer',
                'MCP server'
              )}
            >
              <Switch
                checked={state === 'set'}
                disabled={!programFound || state === 'unreadable' || pendingAgent !== null}
                onCheckedChange={(enabled) => void toggle(agent, enabled)}
                aria-label={translate(
                  'auto.components.marketplace.MarketplaceEngramMcpSwitches.mcpSwitch',
                  'Engram MCP server for {{agent}}',
                  { agent: label }
                )}
              />
            </MarketplaceInfoRow>
            {state === 'unreadable' ? (
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.marketplace.MarketplaceEngramMcpSwitches.unreadable',
                  "Could not read {{agent}}'s settings, so it cannot be switched here.",
                  { agent: label }
                )}
              </p>
            ) : null}
            {errors[agent] ? <p className="text-xs text-destructive">{errors[agent]}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
