import { describe, expect, it } from 'vitest'
import { groupPrototypeSets, type PrototypeChatEntry } from './prototype-sets'

const user = (messageId: string, text: string): PrototypeChatEntry => ({
  role: 'user',
  messageId,
  text
})

const reply = (
  messageId: string,
  visuals: { file: string; title: string }[]
): PrototypeChatEntry => ({ role: 'assistant', messageId, text: '', visuals })

describe('groupPrototypeSets', () => {
  it('groups the visuals of a request reply into lettered directions at version 1', () => {
    expect(
      groupPrototypeSets(
        [
          user('u1', 'Make 3 prototypes of the pricing page'),
          reply('a1', [
            { file: 'pricing-1.html', title: 'Minimal' },
            { file: 'pricing-2.html', title: 'Bold' }
          ]),
          reply('a2', [{ file: 'pricing-3.html', title: 'Dense' }])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Make 3 prototypes of the pricing page',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'pricing-1.html', title: 'Minimal', messageId: 'a1' }]
          },
          {
            letter: 'B',
            versions: [{ version: 1, file: 'pricing-2.html', title: 'Bold', messageId: 'a1' }]
          },
          {
            letter: 'C',
            versions: [{ version: 1, file: 'pricing-3.html', title: 'Dense', messageId: 'a2' }]
          }
        ]
      }
    ])
  })

  it('starts a set from a /prototype command for any agent', () => {
    expect(
      groupPrototypeSets(
        [user('u1', '/prototype a login'), reply('a1', [{ file: 'login.html', title: 'Login' }])],
        'antigravity'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: '/prototype a login',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'login.html', title: 'Login', messageId: 'a1' }]
          }
        ]
      }
    ])
  })

  it('treats another agent native command as an ordinary message', () => {
    expect(
      groupPrototypeSets(
        [user('u1', '/stitch a login'), reply('a1', [{ file: 'login.html', title: 'Login' }])],
        'claude'
      )
    ).toEqual([
      {
        setId: 'orphan:a1:0',
        requestMessageId: 'a1',
        requestText: '',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'login.html', title: 'Login', messageId: 'a1' }]
          }
        ]
      }
    ])
  })

  it('makes the first visual after "Iterate on B." the next version of B and ignores the rest', () => {
    expect(
      groupPrototypeSets(
        [
          user('u1', 'Make 2 prototypes of the menu'),
          reply('a1', [
            { file: 'menu-1.html', title: 'Compact' },
            { file: 'menu-2.html', title: 'Wide' }
          ]),
          user('u2', 'Iterate on B.\n\nmake the items bigger'),
          reply('a2', [
            { file: 'menu-2b.html', title: 'Wide v2' },
            { file: 'extra.html', title: 'Extra' }
          ]),
          reply('a3', [{ file: 'late.html', title: 'Late' }])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Make 2 prototypes of the menu',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'menu-1.html', title: 'Compact', messageId: 'a1' }]
          },
          {
            letter: 'B',
            versions: [
              { version: 1, file: 'menu-2.html', title: 'Wide', messageId: 'a1' },
              { version: 2, file: 'menu-2b.html', title: 'Wide v2', messageId: 'a2' }
            ]
          }
        ]
      }
    ])
  })

  it('applies an iteration to the most recent set that has directions', () => {
    const sets = groupPrototypeSets(
      [
        user('u1', 'Prototype the header'),
        reply('a1', [{ file: 'header-1.html', title: 'Header' }]),
        user('u2', 'Mockup of the footer'),
        reply('a2', [{ file: 'footer-1.html', title: 'Footer' }]),
        user('u3', 'Iterate on A.'),
        reply('a3', [{ file: 'footer-2.html', title: 'Footer v2' }])
      ],
      'claude'
    )
    expect(sets).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Prototype the header',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'header-1.html', title: 'Header', messageId: 'a1' }]
          }
        ]
      },
      {
        setId: 'request:u2',
        requestMessageId: 'u2',
        requestText: 'Mockup of the footer',
        directions: [
          {
            letter: 'A',
            versions: [
              { version: 1, file: 'footer-1.html', title: 'Footer', messageId: 'a2' },
              { version: 2, file: 'footer-2.html', title: 'Footer v2', messageId: 'a3' }
            ]
          }
        ]
      }
    ])
  })

  it('skips a request that has no visuals yet when choosing the set to iterate', () => {
    expect(
      groupPrototypeSets(
        [
          user('u1', 'Prototype the header'),
          reply('a1', [{ file: 'header-1.html', title: 'Header' }]),
          user('u2', 'Make a mockup of the footer'),
          reply('a2', []),
          user('u3', 'Iterate on A.'),
          reply('a3', [{ file: 'header-2.html', title: 'Header v2' }])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Prototype the header',
        directions: [
          {
            letter: 'A',
            versions: [
              { version: 1, file: 'header-1.html', title: 'Header', messageId: 'a1' },
              { version: 2, file: 'header-2.html', title: 'Header v2', messageId: 'a3' }
            ]
          }
        ]
      }
    ])
  })

  it('treats a reply to an iteration on a letter the latest set lacks as an ordinary reply', () => {
    expect(
      groupPrototypeSets(
        [
          user('u1', 'Prototype the header'),
          reply('a1', [{ file: 'header.html', title: 'Header' }]),
          user('u2', 'Iterate on Z.'),
          reply('a2', [{ file: 'z.html', title: 'Z' }])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Prototype the header',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'header.html', title: 'Header', messageId: 'a1' }]
          }
        ]
      },
      {
        setId: 'orphan:a2:0',
        requestMessageId: 'a2',
        requestText: '',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'z.html', title: 'Z', messageId: 'a2' }]
          }
        ]
      }
    ])
  })

  it('closes a set at the next user message, so later replies do not join it', () => {
    expect(
      groupPrototypeSets(
        [
          user('u1', 'Prototype the header'),
          reply('a1', [{ file: 'header.html', title: 'Header' }]),
          user('u2', 'thanks'),
          reply('a2', [{ file: 'loose.html', title: 'Loose' }])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'request:u1',
        requestMessageId: 'u1',
        requestText: 'Prototype the header',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'header.html', title: 'Header', messageId: 'a1' }]
          }
        ]
      },
      {
        setId: 'orphan:a2:0',
        requestMessageId: 'a2',
        requestText: '',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'loose.html', title: 'Loose', messageId: 'a2' }]
          }
        ]
      }
    ])
  })

  it('makes each visual without a request its own single-direction set', () => {
    expect(
      groupPrototypeSets(
        [
          reply('a1', [
            { file: 'x1.html', title: 'X1' },
            { file: 'x2.html', title: 'X2' }
          ])
        ],
        'claude'
      )
    ).toEqual([
      {
        setId: 'orphan:a1:0',
        requestMessageId: 'a1',
        requestText: '',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'x1.html', title: 'X1', messageId: 'a1' }]
          }
        ]
      },
      {
        setId: 'orphan:a1:1',
        requestMessageId: 'a1',
        requestText: '',
        directions: [
          {
            letter: 'A',
            versions: [{ version: 1, file: 'x2.html', title: 'X2', messageId: 'a1' }]
          }
        ]
      }
    ])
  })

  it('continues the direction letters past Z as AA and AB', () => {
    const visuals = Array.from({ length: 28 }, (_, index) => ({
      file: `v${index}.html`,
      title: `V${index}`
    }))
    const sets = groupPrototypeSets(
      [user('u1', 'Make 28 prototypes'), reply('a1', visuals)],
      'claude'
    )
    expect(
      sets
        .at(0)
        ?.directions.slice(-3)
        .map((direction) => direction.letter)
    ).toEqual(['Z', 'AA', 'AB'])
  })
})
