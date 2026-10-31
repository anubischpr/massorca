import { z } from 'zod'

const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const JEV_MODEL = 'jev-latest'
const QUESTION_NAME = 'decision'
const DEFAULT_TIMEOUT_MS = 8000
const MAX_RESPONSE_CHARS = 65536

export type JevChoiceRequest = {
  /**
   * What is being decided, sent to a third party. The caller guarantees it holds no source, paths,
   * logs or secrets; `isSafeAbstractText` is the filter for free text.
   */
  state: string
  instructions: string
  /** Each option's id and what it means; Jev answers with one of these ids. */
  criteria: Readonly<Record<string, string>>
  timeoutMs?: number
}

export type JevChoice = { choice: string; confidence: number }

export type JevDecisionDeps = {
  isEnabled: () => boolean
  readApiKey: () => string | null
  fetchImpl?: typeof fetch
}

const JevResponse = z.object({
  model: z.string().regex(/^jev-[0-9]+\.[0-9]+\.[0-9]+$/),
  answers: z.object({
    [QUESTION_NAME]: z.object({
      type: z.literal('choice'),
      choice: z.string(),
      confidence: z.number().min(0).max(1)
    })
  })
})

const SAFE_TEXT = /^\p{L}[\p{L}\p{N} ,.;:()-]*$/u
const SENSITIVE_WORD =
  /\b(secret|password|credential|api.?key|token|bearer|https?|private|email)\b/i
const LONG_NUMBER = /\d{5,}/

/** Whether free text is abstract enough to leave this machine. It cannot prove the text is safe. */
export function isSafeAbstractText(text: string): boolean {
  return (
    text.length > 0 &&
    text.length <= 160 &&
    SAFE_TEXT.test(text) &&
    !SENSITIVE_WORD.test(text) &&
    !LONG_NUMBER.test(text)
  )
}

function skipped(reason: string): null {
  // Why: a fixed reason only, so neither the key nor the provider's response can reach a log.
  console.warn(`[jev] decision skipped: ${reason}`)
  return null
}

function readKey(deps: JevDecisionDeps): string | null {
  try {
    return deps.readApiKey()
  } catch {
    return null
  }
}

/**
 * Asks Jev to pick one option. Null means "use your deterministic answer": the feature is off, no key
 * is stored, or the call failed, timed out or answered with anything unexpected. It never throws,
 * and it makes one paid call at most, with no retry.
 */
export async function askJevChoice(
  request: JevChoiceRequest,
  deps: JevDecisionDeps
): Promise<JevChoice | null> {
  // Why first: an off feature must not read the key, which can raise a macOS keychain prompt.
  if (!deps.isEnabled()) {
    return null
  }
  const apiKey = readKey(deps)
  if (!apiKey) {
    return skipped('api_key_unavailable')
  }
  try {
    const response = await (deps.fetchImpl ?? fetch)(JEV_ENDPOINT, {
      method: 'POST',
      // Why: a redirect could carry the bearer key to another host.
      redirect: 'error',
      signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: request.state,
        model: JEV_MODEL,
        questions: {
          [QUESTION_NAME]: {
            type: 'choice',
            instructions: request.instructions,
            criteria: request.criteria
          }
        }
      })
    })
    if (!response.ok) {
      return skipped(`http_${response.status}`)
    }
    const text = await response.text()
    if (text.length > MAX_RESPONSE_CHARS) {
      return skipped('invalid_response')
    }
    const parsed = JevResponse.safeParse(JSON.parse(text))
    if (!parsed.success) {
      return skipped('invalid_response')
    }
    const { choice, confidence } = parsed.data.answers[QUESTION_NAME]
    return Object.hasOwn(request.criteria, choice)
      ? { choice, confidence }
      : skipped('invalid_response')
  } catch {
    return skipped('provider_failure')
  }
}
