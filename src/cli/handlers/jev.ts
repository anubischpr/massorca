import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'

type JevDecisionsStatus = { enabled: boolean; apiKeyConfigured: boolean }

// Why: only the switch and key presence are read from the host, so a key value cannot reach output.
function summarize(status: JevDecisionsStatus): JevDecisionsStatus {
  return {
    enabled: status.enabled === true,
    apiKeyConfigured: status.apiKeyConfigured === true
  }
}

function formatStatus(status: JevDecisionsStatus): string {
  return [
    `Jev decisions: ${status.enabled ? 'enabled' : 'disabled'}`,
    `API key: ${status.apiKeyConfigured ? 'stored' : 'not stored'}`
  ].join('\n')
}

export const JEV_HANDLERS: Record<string, CommandHandler> = {
  'jev status': async (ctx) => {
    const response = await ctx.client.call<JevDecisionsStatus>('jevDecisions.getStatus')
    printResult({ ...response, result: summarize(response.result) }, ctx.json, formatStatus)
  }
}
