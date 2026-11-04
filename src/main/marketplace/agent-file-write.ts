import { existsSync, mkdirSync, realpathSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { writeFileAtomicallyIfUnchanged } from '../codex-accounts/fs-utils'
import { writeTomlConfigAtomically } from '../codex/config-toml-atomic-write'
import { writeRollingFileBackup } from '../rolling-file-backup'
import { readConfigText } from './agent-mcp-config'

const WRITE_ATTEMPTS = 3

/** Why: a dotfiles symlink must keep pointing at its target, so the target is what gets replaced. */
function resolveWritePath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

export type TextEdit = (current: string | null) => string | null

export type TextFileWrite =
  | { kind: 'written' | 'unchanged' }
  | { kind: 'failed'; reason: 'unreadable-config' | 'unsupported-shape' | 'failed' }

/**
 * Reads the file, applies the edit and writes the result, backing the previous bytes up first.
 * Retries when the file changes between the read and the write, since agents rewrite their own
 * config while they run. The edit returns null for a shape it will not touch: nothing is written.
 */
export function editTextFileWithBackup(
  path: string,
  edit: TextEdit,
  mode: 'toml' | 'text'
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
    if (mode === 'toml') {
      // Why: the TOML writer owns the symlink resolution and the .bak backup.
      writeTomlConfigAtomically(path, next)
      return { kind: 'written' }
    }
    const target = resolveWritePath(path)
    mkdirSync(dirname(target), { recursive: true })
    const fileMode = existsSync(target) ? statSync(target).mode : 0o600
    if (current !== null) {
      writeRollingFileBackup(target, `${target}.massorca-backup`)
    }
    if (writeFileAtomicallyIfUnchanged(target, current, next, { mode: fileMode })) {
      return { kind: 'written' }
    }
  }
  return { kind: 'failed', reason: 'failed' }
}
