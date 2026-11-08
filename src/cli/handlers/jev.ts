import type { CommandHandler, HandlerContext } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { readSecretInput } from './marketplace-secret-input'

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

async function callAndPrintStatus(
  ctx: HandlerContext,
  method: string,
  params?: Record<string, unknown>
): Promise<void> {
  const response =
    params === undefined
      ? await ctx.client.call<JevDecisionsStatus>(method)
      : await ctx.client.call<JevDecisionsStatus>(method, params)
  printResult({ ...response, result: summarize(response.result) }, ctx.json, formatStatus)
}

export const JEV_HANDLERS: Record<string, CommandHandler> = {
  'jev status': (ctx) => callAndPrintStatus(ctx, 'jevDecisions.getStatus'),
  'jev enable': (ctx) => callAndPrintStatus(ctx, 'jevDecisions.setEnabled', { enabled: true }),
  'jev disable': (ctx) => callAndPrintStatus(ctx, 'jevDecisions.setEnabled', { enabled: false }),
  'jev clear-key': (ctx) => callAndPrintStatus(ctx, 'jevDecisions.clearApiKey'),
  'jev set-key': async (ctx) => {
    const apiKey = await readSecretInput(ctx.flags, 'key')
    if (apiKey === undefined) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Give the API key with --key-stdin (piped in) or --key-env <NAME>.'
      )
    }
    await callAndPrintStatus(ctx, 'jevDecisions.saveApiKey', { apiKey })
  }
}
