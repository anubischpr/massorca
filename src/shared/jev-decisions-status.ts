/** What Settings may know about the Jev key; its value never crosses the IPC boundary. */
export type JevDecisionsStatus = {
  apiKeyConfigured: boolean
  /** A key is stored but this host cannot decrypt it, so decisions stay deterministic. */
  apiKeyUnreadable: boolean
}
