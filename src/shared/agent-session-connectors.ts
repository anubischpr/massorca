import { sanitizeCrashReportString } from './crash-report-redaction'

/** A bounded, read-only observation from this session's provider connection.
 * Missing snapshots and unknown states never imply a configured server is connected. */
export type AgentSessionConnectorStatus =
  | 'connected'
  | 'failed'
  | 'needs-auth'
  | 'pending'
  | 'disabled'
  | 'unknown'
export type AgentSessionConnectorSnapshot = {
  observedAt: number
  servers: { name: string; status: AgentSessionConnectorStatus; error?: string }[]
}

export function readAgentSessionConnectorSnapshot(
  value: unknown
): AgentSessionConnectorSnapshot | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('observedAt' in value) ||
    typeof value.observedAt !== 'number' ||
    !Number.isFinite(value.observedAt) ||
    !('servers' in value) ||
    !Array.isArray(value.servers) ||
    value.servers.length > 1000
  ) {
    return undefined
  }
  const servers: AgentSessionConnectorSnapshot['servers'] = []
  for (const row of value.servers) {
    if (
      !row ||
      typeof row !== 'object' ||
      typeof row.name !== 'string' ||
      !row.name.trim() ||
      row.name.length > 512 ||
      !['connected', 'failed', 'needs-auth', 'pending', 'disabled', 'unknown'].includes(row.status)
    ) {
      return undefined
    }
    servers.push({
      name: row.name,
      status: row.status,
      // Reuse the existing bounded redactor; never transfer server config or endpoint credentials.
      ...(row.status === 'failed' && typeof row.error === 'string' && row.error.trim()
        ? { error: sanitizeCrashReportString(row.error.trim()) }
        : {})
    })
  }
  return { observedAt: value.observedAt, servers }
}
