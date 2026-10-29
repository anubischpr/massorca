// Why: a host with no git author identity cannot make the empty first commit. Orca retries once
// with this identity so Initialize Git still works; the relay's exec validator allows exactly this
// prefix, so the two sides must share one spelling.
export const INITIAL_COMMIT_IDENTITY_ARGS = [
  '-c',
  'user.name=Orca',
  '-c',
  'user.email=orca@localhost'
] as const

export const INITIAL_COMMIT_MESSAGE = 'Initial commit'

export const GIT_IDENTITY_MISSING_PATTERN =
  /Please tell me who you are|unable to auto-detect email address|empty ident name|user\.name|user\.email/i
