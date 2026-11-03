import { describe, expect, it } from 'vitest'
import type { NativeChatMessage } from '../../../src/shared/native-chat-types'
import { buildPrototypeRequestMessage } from '../../../src/shared/prototype-request'
import {
  finishedChildSessionIds,
  matchChildPrototypeSetsToNotices,
  matchPrototypeSetsToUserTurns,
  prototypeRequestLinkLabel
} from './mobile-prototype-request-links'
import { listedSet } from './mobile-prototype-sets.test-fixture'

const PROMPT = 'Make a mockup of the checkout page'

function turn(id: string, role: NativeChatMessage['role'], text: string): NativeChatMessage {
  return { id, role, blocks: [{ type: 'text', text }], timestamp: 0, source: 'transcript' }
}

function setFor(requestId: string, createdAt: string, prompt = PROMPT, sessionId = 'session-1') {
  return listedSet({ requestId, createdAt, originalPrompt: prompt, sessionId, count: 2 })
}

describe('matchPrototypeSetsToUserTurns', () => {
  it('links a set under the user turn that asked for it', () => {
    const set = setFor('r1', '2026-10-28T20:00:00.000Z')
    const messages = [turn('u0', 'user', 'Hello'), turn('u1', 'user', PROMPT)]
    expect(matchPrototypeSetsToUserTurns([set], messages, 'session-1')).toEqual(
      new Map([['u1', set]])
    )
  })

  it('reads a turn that still carries its hidden instruction as the words that were typed', () => {
    const sent = buildPrototypeRequestMessage({
      text: PROMPT,
      agent: 'codex',
      count: 2,
      requestId: 'r1',
      folderPath: '/chats/c1/prototypes/r1'
    }).sentText
    const set = setFor('r1', '2026-10-28T20:00:00.000Z')
    expect([
      ...matchPrototypeSetsToUserTurns([set], [turn('u1', 'user', sent)], 'session-1').keys()
    ]).toEqual(['u1'])
  })

  it('gives two requests with the same words a turn each, oldest first', () => {
    const first = setFor('r1', '2026-10-28T20:00:00.000Z')
    const second = setFor('r2', '2026-10-28T21:00:00.000Z')
    const messages = [turn('u1', 'user', PROMPT), turn('u2', 'user', PROMPT)]
    const matched = matchPrototypeSetsToUserTurns([second, first], messages, 'session-1')
    expect(matched.get('u1')).toBe(first)
    expect(matched.get('u2')).toBe(second)
  })

  it('links nothing for another chat, an assistant turn or a turn that is not there', () => {
    const other = setFor('r1', '2026-10-28T20:00:00.000Z', PROMPT, 'session-2')
    const absent = setFor('r2', '2026-10-28T20:00:00.000Z', 'Something else entirely')
    const messages = [turn('a1', 'assistant', PROMPT), turn('u1', 'user', PROMPT)]
    expect(matchPrototypeSetsToUserTurns([other, absent], messages, 'session-1').size).toBe(0)
  })
})

describe('prototypeRequestLinkLabel', () => {
  it('names the request and how many directions it asked for', () => {
    expect(prototypeRequestLinkLabel({ originalPrompt: PROMPT, count: 2 })).toBe(
      'Make a mockup of the checkout · set of 2'
    )
  })
})

function finishNotice(id: string, childSessionId: string | null): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    blocks: [
      {
        type: 'text',
        text: 'Child session finished',
        delegation: {
          requestId: `delegation-${id}`,
          title: 'Checkout prototypes',
          status: 'finished',
          outcome: 'succeeded',
          resultSummary: 'Made three directions.',
          childSessionId,
          durationMs: 60_000
        }
      }
    ],
    timestamp: 0,
    source: 'transcript'
  }
}

describe('matchChildPrototypeSetsToNotices', () => {
  it('links the sets a child made under its finish notice in the parent', () => {
    const older = setFor('r1', '2026-11-02T09:00:00.000Z', PROMPT, 'child-1')
    const newer = setFor('r2', '2026-11-02T10:00:00.000Z', PROMPT, 'child-1')
    const messages = [turn('u1', 'user', 'Delegate the prototypes'), finishNotice('n1', 'child-1')]
    expect(matchChildPrototypeSetsToNotices([newer, older], messages)).toEqual(
      new Map([['n1', [older, newer]]])
    )
  })

  it('links nothing for a notice without a child chat or a child that made no set', () => {
    const elsewhere = setFor('r1', '2026-11-02T09:00:00.000Z', PROMPT, 'someone-else')
    const messages = [finishNotice('n1', null), finishNotice('n2', 'child-2')]
    expect(matchChildPrototypeSetsToNotices([elsewhere], messages).size).toBe(0)
  })

  it('names only finished children as chats whose sets the parent lists', () => {
    expect(finishedChildSessionIds([finishNotice('n1', 'child-1'), finishNotice('n2', null)])).toEqual(
      ['child-1']
    )
  })
})
