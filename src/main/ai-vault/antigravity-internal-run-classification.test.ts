import { describe, expect, it } from 'vitest'
import { isAiVaultAutomatedRun } from '../../shared/ai-vault-automated-run'
import {
  BRANCH_NAME_PROMPT_PREFIX,
  CONVERSATION_NAME_PROMPT_PREFIX,
  REPLY_SUGGESTION_PROMPT_PREFIX
} from '../../shared/internal-generation-prompt-prefixes'
import { parseAntigravitySessionContent } from './session-scanner-antigravity-parser'
import { jsonLines } from './session-scanner-test-fixtures'

const openingTime = '2026-07-15T11:39:10.000Z'

// Why: an Antigravity transcript opens with the prompt wrapped in USER_REQUEST, so the
// classifier must see the unwrapped prompt for an internal run to read as automated.
async function parseTranscript(prompt: string) {
  const file = {
    path: '/home/ada/.gemini/antigravity-cli/brain/conv-1/.system_generated/logs/transcript.jsonl',
    mtimeMs: Date.parse(openingTime),
    modifiedAt: openingTime
  }
  const session = await parseAntigravitySessionContent(
    file,
    jsonLines([
      {
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        created_at: openingTime,
        content: `<USER_REQUEST>\n${prompt}\n</USER_REQUEST>`
      }
    ]),
    'linux'
  )
  if (!session) {
    throw new Error('Missing parsed fixture session')
  }
  return session
}

describe('Antigravity internal generation runs', () => {
  it.each([
    ['conversation name', `${CONVERSATION_NAME_PROMPT_PREFIX}\n\nReturn only the name.`],
    ['branch name', `${BRANCH_NAME_PROMPT_PREFIX}\n\nTask: fix the login bug.`],
    ['reply suggestion', `${REPLY_SUGGESTION_PROMPT_PREFIX}\n\nRecent turns follow.`]
  ])('classifies a %s run wrapped in USER_REQUEST as automated', async (_label, prompt) => {
    expect(isAiVaultAutomatedRun(await parseTranscript(prompt))).toBe(true)
  })

  it('keeps a typed request visible', async () => {
    const session = await parseTranscript('Improve the opportunities explorer')

    expect(isAiVaultAutomatedRun(session)).toBe(false)
  })
})
