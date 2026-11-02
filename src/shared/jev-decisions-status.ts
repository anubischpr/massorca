import type { SecretAtRestProtection } from './secret-at-rest-protection'

/** What Settings may know about the Jev key; its value never crosses the IPC boundary. */
export type JevDecisionsStatus = {
  apiKeyConfigured: boolean
  /** A key is stored but this host cannot decrypt it, so decisions stay deterministic. */
  apiKeyUnreadable: boolean
  /** Null when no key is stored. */
  apiKeyProtection: SecretAtRestProtection | null
  /** The host's switch, reported only by a remote host; locally it is an ordinary setting. */
  enabled?: boolean
}
