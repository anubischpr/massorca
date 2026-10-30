// Composer phrasing that hands a design to a child session or a subagent. The chat sends such a message as typed:
// the child's own first prompt is what makes its prototype request.
const DELEGATED_ASK_PATTERNS: readonly RegExp[] = [
  /\bsesi[oó]n(?:es)?\s+hijas?\b/iu,
  /\bchild\s+sessions?\b/iu,
  /\bsub-?agent(?:e|es|s)?\b/iu,
  /\bdelega\p{L}*\b[^\n]{0,120}?\bsesi[oó]n/iu,
  /\bdelegat\p{L}*\b[^\n]{0,120}?\bsessions?\b/iu
]

/** Whether a composer message hands its design to a child session or a subagent. */
export function asksForDelegatedSession(text: string): boolean {
  return DELEGATED_ASK_PATTERNS.some((pattern) => pattern.test(text))
}
