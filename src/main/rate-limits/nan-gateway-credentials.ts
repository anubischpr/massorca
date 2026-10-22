import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isRecord } from '../../shared/agent-status-child-work-value-guards'

export type NanGatewayCredentialReadResult = { status: 'ok'; apiKey: string } | { status: 'missing' }

// Why: PI_CODING_AGENT_DIR is the same override Gentle Shell honours for its agent home.
export function getGentleShellAuthPath(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim()
  return join(configured || join(home, '.gentle-shell', 'agent'), 'auth.json')
}

// Why: Pi resolves a leading "!" as a shell command; Orca never executes it and treats the key as absent.
function usableKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const key = value.trim()
  return key && !key.startsWith('!') && !/[\r\n]/.test(key) ? key : null
}

async function readStoredNanKey(authPath: string): Promise<string | null> {
  try {
    const auth: unknown = JSON.parse(await readFile(authPath, 'utf-8'))
    const entry = isRecord(auth) ? auth.nan : null
    return isRecord(entry) && (entry.type === undefined || entry.type === 'api_key')
      ? usableKey(entry.key)
      : null
  } catch {
    return null
  }
}

/**
 * Read-only lookup of the NaN gateway key Gentle Shell uses: its stored `nan`
 * API-key credential first, then NAN_API_KEY, exactly like the shell's own provider.
 */
export async function readNanGatewayCredential(
  options: { env?: NodeJS.ProcessEnv; home?: string } = {}
): Promise<NanGatewayCredentialReadResult> {
  const env = options.env ?? process.env
  const apiKey =
    (await readStoredNanKey(getGentleShellAuthPath(env, options.home))) ??
    usableKey(env.NAN_API_KEY)
  return apiKey ? { status: 'ok', apiKey } : { status: 'missing' }
}
