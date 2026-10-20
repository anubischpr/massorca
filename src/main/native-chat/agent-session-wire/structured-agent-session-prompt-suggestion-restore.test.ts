import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../../shared/agent-session-journal-types'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../shared/agent-session-journal-types'
import type { AgentSessionSubscribeEvent } from '../../../shared/agent-session-wire'
import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import {
  closeTestJournalHostDatabase,
  createTrackedJournalOpener,
  openTestJournalHostDatabase
} from '../agent-session-journal/journal-host-database-test-support'
import {
  promptSuggestionRowsIn,
  readPromptSuggestionRow
} from '../agent-session-journal/prompt-suggestion-rows'
import { AgentSessionSubscribers } from './structured-agent-session-subscribers'

const SESSION = 'restore-session'
const SUGGESTION: NativeChatReplySuggestion = {
  turnId: 'turn-1',
  text: 'Run the tests',
  source: 'native'
}
const IDENTITY = {
  sessionId: SESSION,
  workspaceId: 'workspace-1',
  hostId: 'local',
  agent: 'codex' as const,
  providerHandle: codexProviderHandle('thread-1')
}

let root: string
const journals = createTrackedJournalOpener()

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-restore-suggestions-'))
})

afterEach(async () => {
  await journals.closeAll()
  await rm(root, { recursive: true, force: true })
})

function userItem(clientMessageId: string): AgentJournalItemIdentity {
  return { provider: 'orca', clientMessageId }
}

function turnItem(turnId: string): AgentJournalItemIdentity {
  return {
    provider: 'legacy',
    agent: 'codex',
    sessionId: SESSION,
    recordId: `turn-lifecycle:${turnId}`
  }
}

function userBody(text: string): AgentJournalItemBody {
  return { kind: 'message', role: 'user', blocks: [{ type: 'text', text }] }
}

/** A host process: its chat's journal and subscribers over the one database of `stateDirectory`. */
async function startHost(stateDirectory: string) {
  const journal = await journals.open({ identity: IDENTITY, stateDirectory })
  const subscribers = new AgentSessionSubscribers({
    promptSuggestionRows: promptSuggestionRowsIn(openTestJournalHostDatabase(stateDirectory))
  })
  return { journal, subscribers }
}

/** Ends the process as a restart does: the chat, then its database. */
async function stopHost(journal: AgentSessionJournal, stateDirectory: string): Promise<void> {
  await journal.close()
  closeTestJournalHostDatabase(stateDirectory)
}

/** Appends a user message, and a turn that runs and settles after it, as a finished send does. */
async function finishTurn(journal: AgentSessionJournal, turnId: string): Promise<void> {
  await journal.appendItem(userItem(`msg-${turnId}`), userBody('Fix it'), {
    fence: 1,
    turnScope: AGENT_JOURNAL_THREAD_SCOPE
  })
  await journal.appendItem(
    turnItem(turnId),
    { kind: 'turn', turnId, state: 'running' },
    { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  await journal.appendItem(
    turnItem(turnId),
    { kind: 'turn', turnId, state: 'completed' },
    { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
}

/** The frames a subscriber opened now receives. */
function openSubscriber(
  subscribers: AgentSessionSubscribers,
  journal: AgentSessionJournal
): AgentSessionSubscribeEvent[] {
  const events: AgentSessionSubscribeEvent[] = []
  subscribers.open({
    id: 's1',
    sessionId: SESSION,
    journal,
    fence: 1,
    emit: (event) => events.push(event)
  })
  return events
}

describe('restart-safe prompt suggestion', () => {
  it('restores the held suggestion after a restart, for the newest settled turn', async () => {
    const dir = join(root, 'restore')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    await stopHost(before.journal, dir)

    const after = await startHost(dir)
    const events = openSubscriber(after.subscribers, after.journal)
    expect(events[0]).toMatchObject({ type: 'snapshot', promptSuggestion: SUGGESTION })
  })

  it('does not restore it once a newer turn has run', async () => {
    const dir = join(root, 'newer-turn')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    await finishTurn(before.journal, 'turn-2')
    await stopHost(before.journal, dir)

    const after = await startHost(dir)
    expect(openSubscriber(after.subscribers, after.journal)[0]).not.toHaveProperty(
      'promptSuggestion'
    )
  })

  it('does not restore it after a user message the journal has not yet turned into a turn', async () => {
    const dir = join(root, 'late-input')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    await before.journal.appendItem(userItem('msg-late'), userBody('Actually, no'), {
      fence: 1,
      turnScope: AGENT_JOURNAL_THREAD_SCOPE
    })
    await stopHost(before.journal, dir)

    const after = await startHost(dir)
    expect(openSubscriber(after.subscribers, after.journal)[0]).not.toHaveProperty(
      'promptSuggestion'
    )
  })

  it('keeps a dismissed suggestion dismissed across a restart', async () => {
    const dir = join(root, 'dismissed')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    expect(
      before.subscribers.promptSuggestions.dismiss(SESSION, {
        turnId: SUGGESTION.turnId,
        text: SUGGESTION.text
      })
    ).toBe(true)
    await stopHost(before.journal, dir)

    const after = await startHost(dir)
    expect(openSubscriber(after.subscribers, after.journal)[0]).not.toHaveProperty(
      'promptSuggestion'
    )
  })

  it('clears a suggestion when the user sends after it, live and in the stored row', async () => {
    const dir = join(root, 'sent')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    await before.journal.appendItem(userItem('msg-sent'), userBody('Yes, do it'), {
      fence: 1,
      turnScope: AGENT_JOURNAL_THREAD_SCOPE
    })
    before.subscribers.publish(SESSION, before.journal)

    expect(before.subscribers.promptSuggestions.get(SESSION)).toBeUndefined()
    expect(readPromptSuggestionRow(openTestJournalHostDatabase(dir).db, SESSION)).toBeNull()
    await stopHost(before.journal, dir)

    const after = await startHost(dir)
    expect(openSubscriber(after.subscribers, after.journal)[0]).not.toHaveProperty(
      'promptSuggestion'
    )
  })

  it('removes the stored row when a new turn starts', async () => {
    const dir = join(root, 'new-turn')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    before.subscribers.promptSuggestions.publish(SESSION, null)

    expect(readPromptSuggestionRow(openTestJournalHostDatabase(dir).db, SESSION)).toBeNull()
    await stopHost(before.journal, dir)
  })

  it('ignores a stored row that is corrupted, from another version, or oversized', async () => {
    const dir = join(root, 'bad-row')
    const before = await startHost(dir)
    await finishTurn(before.journal, 'turn-1')
    before.subscribers.promptSuggestions.publish(SESSION, SUGGESTION, before.journal)
    await stopHost(before.journal, dir)

    const corrupt = [
      'not json',
      JSON.stringify({ v: 2, epoch: 'x', anchorTurnId: 'turn-1', userSeq: 0, dismissed: false }),
      JSON.stringify({ v: 1, dismissed: false, suggestion: SUGGESTION }).padEnd(4096, ' ')
    ]
    for (const raw of corrupt) {
      promptSuggestionRowsIn(openTestJournalHostDatabase(dir)).write(SESSION, raw)
      const after = await startHost(dir)
      expect(openSubscriber(after.subscribers, after.journal)[0]).not.toHaveProperty(
        'promptSuggestion'
      )
      await stopHost(after.journal, dir)
    }
  })
})
