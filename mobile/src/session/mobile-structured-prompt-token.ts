type PromptTokenPayload =
  | {
      kind: 'approval'
      itemId: string
      revision: number
      optionId: string
    }
  | {
      kind: 'question-option'
      itemId: string
      revision: number
      questionId: string
      optionId: string
    }
  | {
      kind: 'question-free-text'
      itemId: string
      revision: number
      questionId: string
    }

const STRUCTURED_PROMPT_TOKEN_PREFIX = 'structured-agent-prompt:'

export function encodePromptToken(payload: PromptTokenPayload): string {
  return `${STRUCTURED_PROMPT_TOKEN_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`
}

export function decodePromptToken(value: string): PromptTokenPayload | null {
  if (!value.startsWith(STRUCTURED_PROMPT_TOKEN_PREFIX)) {
    return null
  }
  try {
    const decoded = JSON.parse(
      decodeURIComponent(value.slice(STRUCTURED_PROMPT_TOKEN_PREFIX.length))
    ) as Record<string, unknown>
    if (
      typeof decoded.itemId !== 'string' ||
      typeof decoded.revision !== 'number' ||
      !Number.isFinite(decoded.revision)
    ) {
      return null
    }
    if (decoded.kind === 'approval' && typeof decoded.optionId === 'string') {
      return {
        kind: decoded.kind,
        itemId: decoded.itemId,
        revision: decoded.revision,
        optionId: decoded.optionId
      }
    }
    if (
      decoded.kind === 'question-option' &&
      typeof decoded.questionId === 'string' &&
      typeof decoded.optionId === 'string'
    ) {
      return {
        kind: decoded.kind,
        itemId: decoded.itemId,
        revision: decoded.revision,
        questionId: decoded.questionId,
        optionId: decoded.optionId
      }
    }
    if (decoded.kind === 'question-free-text' && typeof decoded.questionId === 'string') {
      return {
        kind: decoded.kind,
        itemId: decoded.itemId,
        revision: decoded.revision,
        questionId: decoded.questionId
      }
    }
  } catch {
    return null
  }
  return null
}

export function decodeQuestionFreeTextAnswer(value: string): {
  payload: Extract<PromptTokenPayload, { kind: 'question-free-text' }>
  answer: string
} | null {
  if (!value.startsWith(STRUCTURED_PROMPT_TOKEN_PREFIX)) {
    return null
  }
  const separator = value.indexOf(':', STRUCTURED_PROMPT_TOKEN_PREFIX.length)
  if (separator === -1) {
    return null
  }
  const payload = decodePromptToken(value.slice(0, separator))
  if (payload?.kind !== 'question-free-text') {
    return null
  }
  return { payload, answer: decodeURIComponent(value.slice(separator + 1)) }
}
