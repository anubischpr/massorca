import { join } from 'node:path'
import { initInternalAgentRunRegistry } from './internal-agent-run-registry'
import { initSessionParseCachePersistence } from './session-parse-cache-persistence'

/** Enables the AI Vault files under userData; the composition root passes the canonical path. */
export function initAiVaultPersistence(userDataPath: string, appVersion: string): void {
  initSessionParseCachePersistence({
    filePath: join(userDataPath, 'ai-vault', 'session-parse-cache.json'),
    appVersion
  })
  initInternalAgentRunRegistry({
    filePath: join(userDataPath, 'ai-vault', 'internal-agent-runs.json')
  })
}
