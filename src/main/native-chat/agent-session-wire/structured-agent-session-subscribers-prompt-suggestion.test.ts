import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AgentSessionSubscribeEvent } from '../../../shared/agent-session-wire'
import type { NativeChatReplySuggestion } from '../../../shared/native-chat-reply-suggestion'
import { codexProviderHandle } from '../../../shared/agent-session-provider-handle-encoding'
import { createTrackedJournalOpener } from '../agent-session-journal/journal-host-database-test-support'
import { AgentSessionSubscribers } from './structured-agent-session-subscribers'

const SESSION = 'suggestion-session'
const suggestion: NativeChatReplySuggestion = {
  turnId: 'turn-1',
  text: 'Run the tests',
  source: 'native'
}

let root: string
const journals = createTrackedJournalOpener()

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-agent-suggestions-'))
})

afterEach(async () => {
  await journals.closeAll()
  await rm(root, { recursive: true, force: true })
})

function openJournal(name: string) {
  return journals.open({
    identity: {
      sessionId: SESSION,
      workspaceId: 'workspace-1',
      hostId: 'local',
      agent: 'codex',
      providerHandle: codexProviderHandle('thread-1')
    },
    stateDirectory: join(root, name)
  })
}

function suggestionsIn(events: AgentSessionSubscribeEvent[]) {
  return events.flatMap((event) =>
    event.type !== 'end' && event.promptSuggestion !== undefined ? [event.promptSuggestion] : []
  )
}

describe('AgentSessionSubscribers prompt suggestion', () => {
  it('sends a set and a clear to a live subscriber as frames that advance nothing', async () => {
    const journal = await openJournal('live')
    const subscribers = new AgentSessionSubscribers()
    const events: AgentSessionSubscribeEvent[] = []
    subscribers.open({
      id: 's1',
      sessionId: SESSION,
      journal,
      fence: 1,
      emit: (event) => events.push(event)
    })
    events.length = 0

    subscribers.promptSuggestions.publish(SESSION, suggestion)
    subscribers.promptSuggestions.publish(SESSION, null)
    subscribers.promptSuggestions.publish(SESSION, null)

    expect(suggestionsIn(events)).toEqual([suggestion, null])
    expect(events.every((event) => event.type === 'batch' && event.batch.items.length === 0)).toBe(
      true
    )
  })

  it('hands a late subscriber the retained suggestion, on a snapshot and on a resume', async () => {
    const journal = await openJournal('late')
    const subscribers = new AgentSessionSubscribers()
    subscribers.promptSuggestions.publish(SESSION, suggestion)

    const fresh: AgentSessionSubscribeEvent[] = []
    subscribers.open({
      id: 's1',
      sessionId: SESSION,
      journal,
      fence: 1,
      emit: (event) => fresh.push(event)
    })
    expect(fresh[0]).toMatchObject({ type: 'snapshot', promptSuggestion: suggestion })

    const resumed: AgentSessionSubscribeEvent[] = []
    subscribers.open({
      id: 's2',
      sessionId: SESSION,
      journal,
      fence: 1,
      cursor: journal.cursor(),
      emit: (event) => resumed.push(event)
    })
    expect(suggestionsIn(resumed)).toEqual([suggestion])
  })

  it('states no suggestion on an opening snapshot once cleared', async () => {
    const journal = await openJournal('cleared')
    const subscribers = new AgentSessionSubscribers()
    subscribers.promptSuggestions.publish(SESSION, suggestion)
    subscribers.promptSuggestions.publish(SESSION, null)
    const events: AgentSessionSubscribeEvent[] = []
    subscribers.open({
      id: 's1',
      sessionId: SESSION,
      journal,
      fence: 1,
      emit: (event) => events.push(event)
    })
    expect(events[0]).not.toHaveProperty('promptSuggestion')
    expect(subscribers.promptSuggestions.get(SESSION)).toBeUndefined()
  })

  it('drops a suggestion whose source the user turned off', async () => {
    const journal = await openJournal('disabled')
    const subscribers = new AgentSessionSubscribers({
      isPromptSuggestionEnabled: (source) => source !== 'native'
    })
    const events: AgentSessionSubscribeEvent[] = []
    subscribers.open({
      id: 's1',
      sessionId: SESSION,
      journal,
      fence: 1,
      emit: (event) => events.push(event)
    })
    events.length = 0

    subscribers.promptSuggestions.publish(SESSION, suggestion)
    expect(events).toEqual([])
    expect(subscribers.promptSuggestions.get(SESSION)).toBeUndefined()

    subscribers.promptSuggestions.publish(SESSION, { ...suggestion, source: 'emulated' })
    expect(suggestionsIn(events)).toHaveLength(1)
  })
})
