import { describe, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from './agent-session-journal-types'
import { changedFilePathsFromJournalItems } from './native-chat-journal-changed-paths'

const EMPTY_PAYLOAD = { head: '', byteLength: 0, digest: '', truncated: false }
const CHAT_FOLDER = '0123456789abcdef0123456789abcdef'

function diff(path: string, sequence: number): AgentJournalRenderItem {
  return {
    itemId: `diff-${sequence}`,
    revision: 0,
    sequence,
    observedAt: sequence,
    body: { kind: 'diff', path, patch: EMPTY_PAYLOAD }
  }
}

describe('changedFilePathsFromJournalItems', () => {
  it('leaves out prototype files in relative and absolute form, and keeps every other changed file', () => {
    const items = [
      diff('src/app.ts', 1),
      diff('prototypes/20261028-201500-aaaaaa/A.html', 2),
      diff(
        `C:\\state\\native-chat-visuals\\${CHAT_FOLDER}\\prototypes\\20261028-201500-aaaaaa\\B-v2.html`,
        3
      ),
      diff(
        `C:/state/native-chat-visuals/${CHAT_FOLDER}/prototypes/20261028-201500-aaaaaa/notes/shot.png`,
        4
      ),
      diff(`C:/state/native-chat-visuals/${CHAT_FOLDER}/other.html`, 5),
      diff('design/bold/home.html', 6)
    ]

    expect(changedFilePathsFromJournalItems(items)).toEqual([
      'src/app.ts',
      `C:/state/native-chat-visuals/${CHAT_FOLDER}/other.html`,
      'design/bold/home.html'
    ])
  })
})
