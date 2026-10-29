import { sessionPromptPreview } from './ai-vault-session-display'
import type { AiVaultSession } from './ai-vault-types'

export type AiVaultAutomatedRunKind = 'review' | 'sdd'

// Why: headless runs open with a fixed prompt, and Claude, Gemini and Antigravity transcripts
// carry no other marker, so the opening prompt is the only signal the list has for them.
const REVIEW_PROMPT_PREFIX = 'You are a code reviewer'
const SDD_WORKER_PROMPT_PATTERN = /^You are the sdd-[\w-]+ subagent/

/**
 * The kind of headless run a session is, read from its title or opening prompt, or null.
 * A Codex `exec` run with no known prefix is still automated; see {@link isAiVaultAutomatedRun}.
 */
export function aiVaultAutomatedRunKind(session: AiVaultSession): AiVaultAutomatedRunKind | null {
  return (
    automatedRunKindOfPrompt(session.title) ?? automatedRunKindOfPrompt(openingPromptText(session))
  )
}

/** Whether the list hides this session unless its "Automated runs" switch is on. */
export function isAiVaultAutomatedRun(session: AiVaultSession): boolean {
  return session.headlessRun === true || aiVaultAutomatedRunKind(session) !== null
}

/**
 * Applies the "Automated runs" switch to sessions already narrowed by scope, agent, empty and
 * query. The count is taken before hiding, so it is the scope's automated runs either way.
 */
export function applyAiVaultAutomatedRunsSwitch(
  sessions: readonly AiVaultSession[],
  showAutomatedRuns: boolean
): { sessions: AiVaultSession[]; automatedRunCount: number } {
  let automatedRunCount = 0
  const shown: AiVaultSession[] = []
  for (const session of sessions) {
    const automated = isAiVaultAutomatedRun(session)
    if (automated) {
      automatedRunCount += 1
    }
    if (showAutomatedRuns || !automated) {
      shown.push(session)
    }
  }
  return { sessions: shown, automatedRunCount }
}

function automatedRunKindOfPrompt(prompt: string | null): AiVaultAutomatedRunKind | null {
  const text = prompt?.trimStart() ?? ''
  if (text.startsWith(REVIEW_PROMPT_PREFIX)) {
    return 'review'
  }
  return SDD_WORKER_PROMPT_PATTERN.test(text) ? 'sdd' : null
}

function openingPromptText(session: AiVaultSession): string | null {
  // Why: a truncated preview starts mid-conversation, so its first user turn is not the ask.
  if (session.previewMessagesTruncated) {
    return session.firstUserPrompt ?? null
  }
  return sessionPromptPreview(session)?.text ?? null
}
