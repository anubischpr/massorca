import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { prepareLegacyTranscriptImport } from './journal-legacy-import'

const FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/antigravity-transcript.scrubbed.jsonl', import.meta.url)
)

describe('prepareLegacyTranscriptImport for Antigravity', () => {
  it('imports the scrubbed transcript into replacement items tied to the conversation id', async () => {
    const result = await prepareLegacyTranscriptImport({
      agent: 'antigravity',
      sessionId: '61da7062-00a1-416c-8fea-a1ca13f5f664',
      options: { filePath: FIXTURE_PATH }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.items.length).toBeGreaterThan(0)
    expect(result.items[0]?.identity).toMatchObject({
      agent: 'antigravity',
      sessionId: '61da7062-00a1-416c-8fea-a1ca13f5f664',
      provider: 'legacy'
    })
  })
})
