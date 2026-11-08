export const MARKETPLACE_PROGRAMS = [
  'claude',
  'codex',
  'antigravity',
  'gentle-shell',
  'git',
  'gh',
  'node'
] as const
export type MarketplaceProgram = (typeof MARKETPLACE_PROGRAMS)[number]
