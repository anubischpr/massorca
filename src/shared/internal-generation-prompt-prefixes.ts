// Why: the opening line of each MassOrca background prompt lives here, not in its builder, so the
// Session History detector (also bundled for mobile) can match it without importing the builders.
export const CONVERSATION_NAME_PROMPT_PREFIX = "Name this chat from the user's first request."
export const COMMIT_MESSAGE_PROMPT_PREFIX = 'You are generating a single git commit message.'
export const PULL_REQUEST_FIELDS_PROMPT_PREFIX = 'You are generating pull request details.'
// A custom branch-name prompt leads instead of this line, so only the default one is matched.
export const BRANCH_NAME_PROMPT_PREFIX =
  'Generate a short git branch name that summarizes the coding task described below.'
export const REPLY_SUGGESTION_PROMPT_PREFIX =
  'Predict what the user will most likely type next in this chat with a coding agent.'

export const INTERNAL_GENERATION_PROMPT_PREFIXES: readonly string[] = [
  CONVERSATION_NAME_PROMPT_PREFIX,
  COMMIT_MESSAGE_PROMPT_PREFIX,
  PULL_REQUEST_FIELDS_PROMPT_PREFIX,
  BRANCH_NAME_PROMPT_PREFIX,
  REPLY_SUGGESTION_PROMPT_PREFIX
]
