import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { hasRuntimeRpcErrorCode } from '../../../../shared/runtime-rpc-error-code'

const RPC_TIMEOUT_MS = 30_000

export type RuntimeIntegrationId = 'linear' | 'jira'
export type RuntimeIntegrationItem = { id: string; name: string }
export type RuntimeIntegrationStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; connected: boolean; items: RuntimeIntegrationItem[] }
  | { kind: 'update-required' }
  | { kind: 'failed' }

const METHODS = {
  linear: { status: 'linear.status', disconnect: 'linear.disconnect', selector: 'workspaceId' },
  jira: { status: 'jira.status', disconnect: 'jira.disconnect', selector: 'siteId' }
} as const

// Why: rebuilt from the fields the page shows, so any other field a host adds never reaches the view.
const LinearStatusAnswer = z.object({
  connected: z.boolean(),
  workspaces: z.array(z.object({ id: z.string(), organizationName: z.string() })).optional()
})
const JiraStatusAnswer = z.object({
  connected: z.boolean(),
  sites: z.array(z.object({ id: z.string(), siteUrl: z.string() })).optional()
})

function environment(environmentId: string): { kind: 'environment'; environmentId: string } {
  return { kind: 'environment', environmentId }
}

/** Reads the connections one picked runtime host stores for one provider. */
export async function readRuntimeIntegrationStatus(
  environmentId: string,
  id: RuntimeIntegrationId
): Promise<RuntimeIntegrationStatus> {
  try {
    const answer: unknown = await callRuntimeRpc<unknown>(
      environment(environmentId),
      METHODS[id].status,
      undefined,
      { timeoutMs: RPC_TIMEOUT_MS }
    )
    if (id === 'linear') {
      const parsed = LinearStatusAnswer.safeParse(answer)
      return parsed.success
        ? {
            kind: 'ready',
            connected: parsed.data.connected,
            items: (parsed.data.workspaces ?? []).map((workspace) => ({
              id: workspace.id,
              name: workspace.organizationName
            }))
          }
        : { kind: 'failed' }
    }
    const parsed = JiraStatusAnswer.safeParse(answer)
    return parsed.success
      ? {
          kind: 'ready',
          connected: parsed.data.connected,
          items: (parsed.data.sites ?? []).map((site) => ({ id: site.id, name: site.siteUrl }))
        }
      : { kind: 'failed' }
  } catch (error) {
    return hasRuntimeRpcErrorCode(error, 'method_not_found')
      ? { kind: 'update-required' }
      : { kind: 'failed' }
  }
}

/** Disconnects every connection of one provider on a picked runtime host, or only one by its id. */
export async function disconnectRuntimeIntegration(
  environmentId: string,
  id: RuntimeIntegrationId,
  itemId: string | null
): Promise<void> {
  const params = itemId === null ? {} : { [METHODS[id].selector]: itemId }
  await callRuntimeRpc<unknown>(environment(environmentId), METHODS[id].disconnect, params, {
    timeoutMs: RPC_TIMEOUT_MS
  })
}

/** The status of one provider on a picked runtime host, read again after each change. */
export function useRuntimeIntegrationStatus(
  environmentId: string | null,
  id: RuntimeIntegrationId
): { status: RuntimeIntegrationStatus; reload: () => Promise<void> } {
  const [status, setStatus] = useState<RuntimeIntegrationStatus>({ kind: 'loading' })
  const reload = useCallback(async (): Promise<void> => {
    if (environmentId === null) {
      return
    }
    setStatus(await readRuntimeIntegrationStatus(environmentId, id))
  }, [environmentId, id])
  useEffect(() => {
    void reload()
  }, [reload])
  return { status, reload }
}
