import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'

const REFUSAL_HINTS: Record<string, string> = {
  not_found: 'no such chat, request or file on this host',
  not_deletable: 'its chat or worktree still exists, or the host cannot tell they are gone',
  unsupported: 'the chat has no record on this host or is not local to it',
  unwritable: 'the host could not write it',
  too_large: 'the file is over the size limit',
  current: 'that version is already the current one',
  conflict: 'another write took the next version first'
}

/** A host answer of `ok: false` is a refusal, so it must exit 1 rather than print as success. */
export function prototypeRefusal(action: string, error: string): RuntimeClientError {
  const hint = REFUSAL_HINTS[error]
  return new RuntimeClientError(
    'prototype_refused',
    `${action} failed: ${error}${hint ? ` (${hint})` : ''}.`
  )
}

export function getSessionAndRequest(flags: Map<string, string | boolean>): {
  sessionId: string
  requestId: string
} {
  return {
    sessionId: getRequiredStringFlag(flags, 'session'),
    requestId: getRequiredStringFlag(flags, 'request')
  }
}

export function getOptionalEnumFlag<T extends string>(
  flags: Map<string, string | boolean>,
  name: string,
  allowed: readonly T[]
): T | undefined {
  const value = getOptionalStringFlag(flags, name)
  if (value === undefined) {
    return undefined
  }
  const match = allowed.find((candidate) => candidate === value)
  if (match === undefined) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Invalid --${name} "${value}". Use ${allowed.join(', ')}.`
    )
  }
  return match
}

export function getRequiredVersionFlag(flags: Map<string, string | boolean>): number {
  const raw = getRequiredStringFlag(flags, 'version')
  const version = Number(raw)
  if (!Number.isInteger(version) || version < 1 || version > 10_000) {
    throw new RuntimeClientError(
      'invalid_argument',
      '--version must be a whole number from 1 to 10000.'
    )
  }
  return version
}
