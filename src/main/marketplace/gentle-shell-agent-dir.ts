import { homedir } from 'node:os'
import { join } from 'node:path'

/** Gentle Shell's agent folder: `PI_CODING_AGENT_DIR` when set, else `~/.gentle-shell/agent`. */
export function gentleShellAgentDir(
  env: Readonly<Record<string, string | undefined>> = process.env,
  home: string = homedir()
): string {
  return env.PI_CODING_AGENT_DIR?.trim() || join(home, '.gentle-shell', 'agent')
}
