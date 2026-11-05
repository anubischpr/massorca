import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { writeFileAtomicallyIfUnchanged } from '../codex-accounts/fs-utils'
import { writeTomlConfigAtomically } from '../codex/config-toml-atomic-write'
import { writeRollingFileBackup } from '../rolling-file-backup'
import { readConfigText } from './agent-mcp-config'
import { resolveWriteTarget } from './marketplace-agent-paths'
import { keepFirstOriginal } from './marketplace-file-original-backup'

const WRITE_ATTEMPTS = 3

export type TextEdit = (current: string | null) => string | null

/** Why a write did not happen; `outside-home` means a link led the file out of the home folder. */
export type AgentWriteFailureReason =
  | 'unreadable-config'
  | 'unsupported-shape'
  | 'outside-home'
  | 'failed'

export type TextFileWrite =
  | { kind: 'written' | 'unchanged' }
  | { kind: 'failed'; reason: AgentWriteFailureReason }

/**
 * Reads the file, applies the edit and writes the result, backing the previous bytes up first.
 * Retries when the file changes between the read and the write, since agents rewrite their own
 * config while they run. The edit returns null for a shape it will not touch: nothing is written.
 * A link in the way is followed so a dotfiles setup keeps working, unless it leaves `home`.
 */
export function editTextFileWithBackup(
  path: string,
  edit: TextEdit,
  mode: 'toml' | 'text',
  home?: string
): TextFileWrite {
  for (let attempt = 0; attempt < (mode === 'toml' ? 1 : WRITE_ATTEMPTS); attempt++) {
    const read = readConfigText(path)
    if (read.kind === 'unavailable') {
      return { kind: 'failed', reason: 'unreadable-config' }
    }
    const current = read.kind === 'present' ? read.text : null
    const next = edit(current)
    if (next === null) {
      return { kind: 'failed', reason: 'unsupported-shape' }
    }
    if (next === (current ?? '')) {
      return { kind: 'unchanged' }
    }
    const target = resolveWriteTarget(path, home)
    if (target === null) {
      return { kind: 'failed', reason: 'outside-home' }
    }
    if (mode === 'toml') {
      // Why: the TOML writer owns the symlink resolution and the .bak backup.
      if (current !== null) {
        keepFirstOriginal(target)
      }
      writeTomlConfigAtomically(path, next)
      return { kind: 'written' }
    }
    mkdirSync(dirname(target), { recursive: true })
    const fileMode = existsSync(target) ? statSync(target).mode : 0o600
    if (current !== null) {
      keepFirstOriginal(target)
      writeRollingFileBackup(target, `${target}.massorca-backup`)
    }
    if (writeFileAtomicallyIfUnchanged(target, current, next, { mode: fileMode })) {
      return { kind: 'written' }
    }
  }
  return { kind: 'failed', reason: 'failed' }
}
