import { describe, expect, it } from 'vitest'
import {
  nativeChatChecklist,
  nativeChatChecklistBlocksInReply,
  nativeChatChecklistUpdateText,
  splitNativeChatChecklistUpdate,
  type NativeChatChecklistPersonState
} from './native-chat-checklist'

const block = (body: string) => ['Here is the list.', '```orca-checklist', body, '```', 'Done.'].join('\n')

function person(
  marks: NativeChatChecklistPersonState['marks'],
  extra: Partial<NativeChatChecklistPersonState> = {}
): NativeChatChecklistPersonState {
  return { revision: 5, deliveredRevision: 0, title: null, marks, ...extra }
}

describe('nativeChatChecklistBlocksInReply', () => {
  it('reads the title and items of an orca-checklist fence', () => {
    expect(
      nativeChatChecklistBlocksInReply(block('title: QA preview\n- [ ] One\n* [x] Two\n- [X]  Three '))
    ).toEqual([
      {
        title: 'QA preview',
        items: [
          { text: 'One', checked: false },
          { text: 'Two', checked: true },
          { text: 'Three', checked: true }
        ]
      }
    ])
  })

  it('ignores other fences, task lists outside the fence and an unclosed block', () => {
    const markdown = '- [ ] outside\n```ts\n- [ ] code\n```\n```orca-checklist\n- [ ] open'
    expect(nativeChatChecklistBlocksInReply(markdown)).toEqual([])
  })

  it('keeps the first of two items with the same text', () => {
    expect(nativeChatChecklistBlocksInReply(block('- [ ] One\n- [x] one'))[0].items).toEqual([
      { text: 'One', checked: false }
    ])
  })
})

describe('nativeChatChecklist', () => {
  it('is null until the agent writes a block', () => {
    expect(nativeChatChecklist([{ at: 1, markdown: 'no list' }], null)).toBeNull()
  })

  it('uses the latest block and credits the agent with the items it checked', () => {
    const list = nativeChatChecklist(
      [
        { at: 10, markdown: block('title: QA\n- [ ] One\n- [ ] Two') },
        { at: 20, markdown: block('- [x] One\n- [ ] Two\n- [ ] Three') }
      ],
      null
    )
    expect(list?.title).toBe('QA')
    expect(list?.checked).toBe(1)
    expect(list?.items.map((item) => [item.text, item.checked, item.by, item.at])).toEqual([
      ['One', true, 'agent', 20],
      ['Two', false, null, null],
      ['Three', false, null, null]
    ])
  })

  it('lets the later of the agent and the person win, and keeps notes', () => {
    const replies = [
      { at: 10, markdown: block('- [ ] One\n- [ ] Two') },
      { at: 30, markdown: block('- [ ] One\n- [ ] Two') }
    ]
    const marks = {
      one: { text: 'One', checked: true, checkedAt: 20, revision: 1 },
      two: { text: 'Two', checked: true, checkedAt: 40, note: 'Falla', noteAt: 41, revision: 2 }
    }
    const list = nativeChatChecklist(replies, person(marks, { deliveredRevision: 1 }))
    expect(list?.items.map((item) => [item.checked, item.by, item.note, item.unseen])).toEqual([
      [true, 'person', null, false],
      [true, 'person', 'Falla', true]
    ])
    expect(list?.unseen).toBe(1)

    const agentLater = nativeChatChecklist(
      [...replies, { at: 50, markdown: block('- [ ] One\n- [x] Two') }],
      person(marks)
    )
    expect(agentLater?.items[0]).toMatchObject({ checked: true, by: 'person' })
    // The agent's later uncheck of One never happened (it stayed unchecked), so the person wins it.
    const unchecked = nativeChatChecklist(
      [
        { at: 10, markdown: block('- [x] One') },
        { at: 60, markdown: block('- [ ] One') }
      ],
      person({ one: { text: 'One', checked: true, checkedAt: 20, revision: 1 } })
    )
    expect(unchecked?.items[0]).toMatchObject({ checked: false, by: 'agent', at: 60 })
  })
})

describe('nativeChatChecklistUpdateText', () => {
  it('lists only the marks the agent has not seen, with notes and screenshot paths', () => {
    const update = nativeChatChecklistUpdateText(
      person(
        {
          one: { text: 'One', checked: true, checkedAt: 1, revision: 1 },
          two: {
            text: 'Two',
            checked: false,
            checkedAt: 2,
            note: 'Falla:\nicono genérico',
            screenshots: [{ path: '/host/a.png', name: 'a.png' }],
            revision: 3
          },
          three: { text: 'Three', note: 'mirar', revision: 4 }
        },
        { deliveredRevision: 1, title: 'QA' }
      )
    )
    expect(update).toBe(
      [
        '<orca-checklist-update>',
        'Checklist "QA": changes by the person since your last turn.',
        '- [ ] Two (unchecked by the person)',
        '  note: Falla: icono genérico',
        '  screenshot: /host/a.png',
        '- Three',
        '  note: mirar',
        '</orca-checklist-update>'
      ].join('\n')
    )
  })

  it('is null when nothing changed since the last delivery', () => {
    expect(
      nativeChatChecklistUpdateText(
        person({ one: { text: 'One', checked: true, revision: 2 } }, { deliveredRevision: 2 })
      )
    ).toBeNull()
  })
})

describe('splitNativeChatChecklistUpdate', () => {
  it('separates the host block from what the person typed', () => {
    expect(
      splitNativeChatChecklistUpdate('<orca-checklist-update>\nA\n</orca-checklist-update>\n\nHola')
    ).toEqual({ update: 'A', rest: 'Hola' })
    expect(splitNativeChatChecklistUpdate('Hola')).toEqual({ update: null, rest: 'Hola' })
  })
})
