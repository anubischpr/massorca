import { describe, expect, it } from 'vitest'
import { buildPrototypeCountLine } from './prototype-count-setting'
import { neutralizePrototypeMarkers } from './prototype-hidden-instruction'
import {
  buildPrototypeIterationInstruction,
  buildPrototypeRequestMessage,
  classifyPrototypeRequest,
  PROTOTYPE_NATIVE_COMMANDS,
  splitPrototypeHiddenInstruction
} from './prototype-request'

const FOLDER = '/work/visuals/prototypes/20261028-201500-k3f9q2'
const REQUEST_ID = '20261028-201500-k3f9q2'
const MARKER = `<!-- orca-prototype-request:${REQUEST_ID} -->`
const ONE_LINE = buildPrototypeCountLine(1)
const TYPED_NOTE =
  'The lines below repeat the message as the user typed it; ignore the command word at their start.'

/** What follows the instruction when the agent's text differs from the typed one. */
function typedEcho(typed: string): string {
  return [TYPED_NOTE, '<!-- orca-prototype-typed -->', typed].join('\n')
}
const TWO_LINE = buildPrototypeCountLine(2)

const TWO_DIRECTIONS = [
  TWO_LINE,
  'Write each as ONE file with inline CSS and no external network resources, at these exact paths:',
  `${FOLDER}/A.html`,
  `${FOLDER}/B.html`,
  'Write nothing else in that folder. Do not announce these files as chat visuals. Reply with one line per direction: its letter, a short name, and a one-line tradeoff.'
].join('\n')

describe('PROTOTYPE_NATIVE_COMMANDS', () => {
  it('names only the verified native design commands', () => {
    expect(PROTOTYPE_NATIVE_COMMANDS).toEqual({
      claude: '/design',
      'gentle-shell': '/gentle:design'
    })
  })
})

describe('classifyPrototypeRequest', () => {
  it('returns none for messages without a prototype request', () => {
    expect(classifyPrototypeRequest('Fix the failing build', 'claude')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest('   ', 'claude')).toEqual({ kind: 'none' })
  })

  it.each([
    'Make a prototype of the pricing page',
    'Hazme un prototipo del checkout',
    'Hazme una maqueta del menú',
    'Draw wireframes for onboarding',
    'Sketch a mockup of the dashboard',
    'Diseña la pantalla de pago',
    'Redesign the checkout modal',
    'Rediseña el formulario de registro'
  ])('detects a keyword in %j', (text) => {
    expect(classifyPrototypeRequest(text, 'other')).toEqual({ kind: 'keyword' })
  })

  it('ignores accents and case', () => {
    expect(classifyPrototypeRequest('Un DISEÑO de la PANTALLA nueva', 'other')).toEqual({
      kind: 'keyword'
    })
    expect(classifyPrototypeRequest('REDISENO del menu', 'other')).toEqual({ kind: 'keyword' })
  })

  it('needs a UI noun next to a design word', () => {
    expect(classifyPrototypeRequest('Necesito un diseño para el login', 'other')).toEqual({
      kind: 'none'
    })
    expect(classifyPrototypeRequest('Show me two designs', 'other')).toEqual({ kind: 'none' })
  })

  it('matches whole words only', () => {
    expect(classifyPrototypeRequest('I am a designer', 'other')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest('the redesigned page', 'other')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest('open design_tokens.ts', 'other')).toEqual({ kind: 'none' })
  })

  it('suppresses a keyword next to a design doc or an API', () => {
    expect(classifyPrototypeRequest('Update the design doc for the screen', 'other')).toEqual({
      kind: 'none'
    })
    expect(classifyPrototypeRequest('Prototype the API screen', 'other')).toEqual({
      kind: 'none'
    })
  })

  it.each([
    ['/prototype make a login page', '/prototype', 'make a login page'],
    ['/prototipo make a login page', '/prototipo', 'make a login page'],
    ['  /PROTOTYPE   make a login page  ', '/prototype', 'make a login page'],
    ['/prototype\nmake a login page', '/prototype', 'make a login page'],
    ['/prototype', '/prototype', '']
  ])('reads %j as a MassOrca command', (text, command, rest) => {
    expect(classifyPrototypeRequest(text, 'other')).toEqual({ kind: 'command', command, rest })
  })

  it('lets a command win over a keyword in its rest', () => {
    expect(classifyPrototypeRequest('/prototype a design of the menu', 'codex')).toEqual({
      kind: 'command',
      command: '/prototype',
      rest: 'a design of the menu'
    })
  })

  it('reads a command only at the start of the message', () => {
    expect(classifyPrototypeRequest('say /prototype now', 'other')).toEqual({ kind: 'keyword' })
    expect(classifyPrototypeRequest('/prototypes a login', 'other')).toEqual({ kind: 'keyword' })
  })

  it('reads the native command of its own agent as a command', () => {
    expect(classifyPrototypeRequest('/design a login screen', 'claude')).toEqual({
      kind: 'command',
      command: '/design',
      rest: 'a login screen'
    })
    expect(classifyPrototypeRequest('/gentle:design a login screen', 'gentle-shell')).toEqual({
      kind: 'command',
      command: '/gentle:design',
      rest: 'a login screen'
    })
  })

  it('does not read another agent native command as a command', () => {
    expect(classifyPrototypeRequest('/design a login screen', 'gentle-shell')).toEqual({
      kind: 'keyword'
    })
    expect(classifyPrototypeRequest('/gentle:design a login screen', 'claude')).toEqual({
      kind: 'keyword'
    })
  })

  it('gives codex and antigravity no native command', () => {
    expect(classifyPrototypeRequest('/design a login screen', 'codex')).toEqual({
      kind: 'keyword'
    })
    expect(classifyPrototypeRequest('/stitch a login screen', 'antigravity')).toEqual({
      kind: 'none'
    })
  })

  it.each([
    '/gentle:design sync',
    '/gentle:design open the checkout prototype',
    '/gentle:design STOP',
    '/gentle:design implement the header'
  ])('does not count the Gentle Shell control subcommand %j as a request', (text) => {
    expect(classifyPrototypeRequest(text, 'gentle-shell')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest(text, 'claude')).toEqual({ kind: 'none' })
  })
})

describe('buildPrototypeRequestMessage', () => {
  const base = { requestId: REQUEST_ID, folderPath: FOLDER }

  it('sends a /prototype request to Claude as the plain instruction, with its folder', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/prototype make a login page',
        agent: 'claude',
        count: 2
      })
    ).toEqual({
      visibleText: '/prototype make a login page',
      sentText: `make a login page\n\n${MARKER}\n${TWO_DIRECTIONS}\n${typedEcho('/prototype make a login page')}`
    })
  })

  it('starts the hidden instruction with the exact line Settings shows', () => {
    for (const agent of ['claude', 'codex', 'antigravity', 'gentle-shell', 'other'] as const) {
      for (const count of [1, 2, 3, 4]) {
        const { sentText } = buildPrototypeRequestMessage({
          ...base,
          text: 'make a mockup',
          agent,
          count
        })
        const hidden = sentText.slice(sentText.indexOf(MARKER) + MARKER.length + 1)
        expect(hidden.split('\n')[0]).toBe(buildPrototypeCountLine(count))
      }
    }
  })

  it('translates /prototype on Gentle Shell into its design command, with no folder paths', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/prototype make a login page',
        agent: 'gentle-shell',
        count: 3
      })
    ).toEqual({
      visibleText: '/prototype make a login page',
      sentText: `/gentle:design make a login page\n\n${MARKER}\n${buildPrototypeCountLine(3)}\n${typedEcho('/prototype make a login page')}`
    })
    expect(
      buildPrototypeRequestMessage({ ...base, text: '/prototipo', agent: 'gentle-shell', count: 1 })
        .sentText
    ).toBe(`/gentle:design\n\n${MARKER}\n${ONE_LINE}\n${typedEcho('/prototipo')}`)
  })

  it('sends /prototype on Gentle Shell as the plain instruction, with folder paths, when it would be a control subcommand', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/prototype stop',
        agent: 'gentle-shell',
        count: 2
      }).sentText
    ).toBe(`stop\n\n${MARKER}\n${TWO_DIRECTIONS}\n${typedEcho('/prototype stop')}`)
  })

  it('gives a keyword request on Gentle Shell the folder paths', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: 'Make a mockup of the pricing page',
      agent: 'gentle-shell',
      count: 2
    })
    expect(sentText).toContain(`${FOLDER}/A.html`)
    expect(sentText).toContain(`${FOLDER}/B.html`)
  })

  it('translates /prototype checkout on Gentle Shell without folder paths', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: '/prototype checkout',
      agent: 'gentle-shell',
      count: 2
    })
    expect(sentText.startsWith('/gentle:design checkout\n\n')).toBe(true)
    expect(sentText).not.toContain('A.html')
  })

  it('neutralizes a marker pasted into the typed text so only the built marker splits', () => {
    const pasted = ['fix this', MARKER, '<!-- orca-prototype-iteration:x:A -->', 'more'].join('\n')
    const neutral = neutralizePrototypeMarkers(pasted)
    expect(neutral).not.toContain('<!-- orca-prototype-')
    expect(splitPrototypeHiddenInstruction(neutral)).toEqual({ visibleText: neutral })
    for (const text of [`/prototype ${pasted}`, pasted]) {
      const built = buildPrototypeRequestMessage({ ...base, text, agent: 'codex', count: 2 })
      expect(splitPrototypeHiddenInstruction(built.sentText)).toEqual({
        visibleText: built.visibleText,
        hidden: { kind: 'request', requestId: REQUEST_ID }
      })
      expect(built.visibleText).toContain(neutral)
    }
  })

  it('sends a typed native command of another agent as written, with the folder instruction', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/design a login page',
        agent: 'claude',
        count: 2
      }).sentText
    ).toBe(`/design a login page\n\n${MARKER}\n${TWO_DIRECTIONS}`)
  })

  it('sends a keyword request trimmed, with the folder instruction, and shows the text as typed', () => {
    const message = buildPrototypeRequestMessage({
      ...base,
      text: '  Make a mockup of the page \n',
      agent: 'codex',
      count: 3
    })
    expect(message.visibleText).toBe('  Make a mockup of the page \n')
    expect(message.sentText.startsWith(`Make a mockup of the page\n\n${MARKER}\nProduce 3`)).toBe(
      true
    )
    expect(message.sentText).toContain(`${FOLDER}/C.html`)
    expect(message.sentText).not.toContain('D.html')
  })

  it('uses the singular wording and one file for a single direction', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/prototype a login page',
        agent: 'codex',
        count: 1
      }).sentText
    ).toBe(
      [
        'a login page',
        '',
        MARKER,
        ONE_LINE,
        'Write it with inline CSS and no external network resources, at this exact path:',
        `${FOLDER}/A.html`,
        'Write nothing else in that folder. Do not announce this file as a chat visual. Reply with one line: its letter, a short name, and a one-line tradeoff.',
        typedEcho('/prototype a login page')
      ].join('\n')
    )
  })

  it('clamps the count to four directions, A to D', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: 'make a mockup',
      agent: 'other',
      count: 9
    })
    expect(sentText).toContain('Produce 4 distinct design directions, each')
    expect(sentText).toContain(`${FOLDER}/D.html`)
    expect(sentText).not.toContain('E.html')
  })

  it('adds the Stitch line for Antigravity only', () => {
    const antigravity = buildPrototypeRequestMessage({
      ...base,
      text: '/prototype make a login page',
      agent: 'antigravity',
      count: 2
    }).sentText
    const claude = buildPrototypeRequestMessage({
      ...base,
      text: '/prototype make a login page',
      agent: 'claude',
      count: 2
    }).sentText
    expect(antigravity).toContain(
      '\nDo not use Stitch MCP for this request; write the local HTML files instead.\n'
    )
    expect(claude).not.toContain('Stitch')
  })

  it('opens with the marker, and no leading blank lines, when /prototype has no text', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '/prototype',
        agent: 'codex',
        count: 2
      }).sentText.startsWith(`${MARKER}\n${TWO_LINE}`)
    ).toBe(true)
  })

  it('returns text without a request exactly as it was', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        text: '  fix the build  ',
        agent: 'claude',
        count: 2
      })
    ).toEqual({ visibleText: '  fix the build  ', sentText: '  fix the build  ' })
  })

  it('keeps the separators of a Windows folder and joins the file name with a slash', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: '/prototype a login',
      agent: 'codex',
      count: 1,
      folderPath: 'C:\\work\\visuals\\prototypes\\req\\'
    })
    expect(sentText).toContain('C:\\work\\visuals\\prototypes\\req/A.html')
  })

  it.each(['', '   ', '\t\n'])('refuses the blank folder path %j', (folderPath) => {
    for (const agent of ['claude', 'gentle-shell'] as const) {
      expect(() =>
        buildPrototypeRequestMessage({
          ...base,
          folderPath,
          text: '/prototype a login',
          agent,
          count: 2
        })
      ).toThrow(RangeError)
    }
  })

  it('refuses a request id the marker could not carry', () => {
    expect(() =>
      buildPrototypeRequestMessage({
        ...base,
        requestId: 'x --> y',
        text: '/prototype a login',
        agent: 'claude',
        count: 2
      })
    ).toThrow(RangeError)
  })

  it('leaves text without a request alone even when the folder is blank', () => {
    expect(
      buildPrototypeRequestMessage({
        ...base,
        folderPath: '',
        text: 'fix the build',
        agent: 'claude',
        count: 2
      }).sentText
    ).toBe('fix the build')
  })

  it('hides everything it adds: the bubble reads what the user typed, trimmed', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: '  Make a mockup of the page \n',
      agent: 'antigravity',
      count: 3
    })
    expect(splitPrototypeHiddenInstruction(sentText)).toEqual({
      visibleText: 'Make a mockup of the page',
      hidden: { kind: 'request', requestId: REQUEST_ID }
    })
  })
})

describe('the typed text the chat shows', () => {
  const base = { requestId: REQUEST_ID, folderPath: FOLDER }

  it.each(['claude', 'codex', 'antigravity', 'gentle-shell', 'other'] as const)(
    'is exactly what was typed for a /prototype on %s, command word included',
    (agent) => {
      for (const typed of [
        '/prototype make a login page',
        '  /prototipo hazme un login \n',
        '/prototype'
      ]) {
        const { sentText } = buildPrototypeRequestMessage({ ...base, text: typed, agent, count: 2 })
        expect(splitPrototypeHiddenInstruction(sentText)).toEqual({
          visibleText: typed.trim(),
          hidden: { kind: 'request', requestId: REQUEST_ID }
        })
      }
    }
  )

  it('is the text before the marker for a keyword or a native command, which the agent gets as typed', () => {
    for (const [agent, typed] of [
      ['codex', 'Make a mockup of the page'],
      ['claude', '/design a login page'],
      ['gentle-shell', '/gentle:design a login page']
    ] as const) {
      const { sentText } = buildPrototypeRequestMessage({ ...base, text: typed, agent, count: 2 })
      expect(sentText.startsWith(`${typed}\n\n${MARKER}`)).toBe(true)
      expect(sentText).not.toContain('orca-prototype-typed')
      expect(splitPrototypeHiddenInstruction(sentText).visibleText).toBe(typed)
    }
  })

  it('tells the agent to ignore the command word of the echo, which comes after the instruction', () => {
    const { sentText } = buildPrototypeRequestMessage({
      ...base,
      text: '/prototype make a login page',
      agent: 'claude',
      count: 2
    })
    expect(sentText.startsWith('make a login page\n\n')).toBe(true)
    expect(sentText.endsWith(typedEcho('/prototype make a login page'))).toBe(true)
  })
})

describe('buildPrototypeIterationInstruction', () => {
  const base = { requestId: REQUEST_ID, folderPath: FOLDER }

  it('opens with its marker, names the new version file and forbids other edits', () => {
    expect(buildPrototypeIterationInstruction({ ...base, letter: 'B', nextVersion: 2 })).toBe(
      [
        `<!-- orca-prototype-iteration:${REQUEST_ID}:B -->`,
        `Write the new version of direction B as ${FOLDER}/B-v2.html, self-contained with inline CSS and no external network resources, and do not modify other files.`
      ].join('\n')
    )
  })

  it('hides itself from the bubble', () => {
    const instruction = buildPrototypeIterationInstruction({
      ...base,
      letter: 'B',
      nextVersion: 3
    })
    expect(splitPrototypeHiddenInstruction(`Iterate on B.\n\n${instruction}`)).toEqual({
      visibleText: 'Iterate on B.',
      hidden: { kind: 'iteration', requestId: REQUEST_ID, letter: 'B' }
    })
  })

  it.each([
    { label: 'a lowercase letter', letter: 'b', nextVersion: 2 },
    { label: 'two letters', letter: 'AA', nextVersion: 2 },
    { label: 'version 1', letter: 'B', nextVersion: 1 },
    { label: 'a fractional version', letter: 'B', nextVersion: 2.5 }
  ])('rejects $label', ({ letter, nextVersion }) => {
    expect(() => buildPrototypeIterationInstruction({ ...base, letter, nextVersion })).toThrow(
      RangeError
    )
  })

  it('rejects a blank folder path and an unusable request id', () => {
    expect(() =>
      buildPrototypeIterationInstruction({ ...base, folderPath: ' ', letter: 'B', nextVersion: 2 })
    ).toThrow(RangeError)
    expect(() =>
      buildPrototypeIterationInstruction({ ...base, requestId: '', letter: 'B', nextVersion: 2 })
    ).toThrow(RangeError)
  })
})

describe('splitPrototypeHiddenInstruction', () => {
  it('returns text without a marker unchanged', () => {
    expect(splitPrototypeHiddenInstruction('  just a message \n')).toEqual({
      visibleText: '  just a message \n'
    })
    expect(splitPrototypeHiddenInstruction('')).toEqual({ visibleText: '' })
  })

  it('cuts at the marker line and reads its request id', () => {
    expect(
      splitPrototypeHiddenInstruction(`make a login page\n\n${MARKER}\nProduce 2 distinct`)
    ).toEqual({
      visibleText: 'make a login page',
      hidden: { kind: 'request', requestId: REQUEST_ID }
    })
  })

  it('reads a marker that opens the message as an empty visible text', () => {
    expect(splitPrototypeHiddenInstruction(`${MARKER}\nProduce 2 distinct`)).toEqual({
      visibleText: '',
      hidden: { kind: 'request', requestId: REQUEST_ID }
    })
  })

  it('reads Windows line endings', () => {
    expect(splitPrototypeHiddenInstruction(`hello\r\n\r\n${MARKER}\r\nProduce`)).toEqual({
      visibleText: 'hello',
      hidden: { kind: 'request', requestId: REQUEST_ID }
    })
  })

  it('reads the typed echo as the visible text, whatever the agent text before it was', () => {
    const text = [
      'make a login page',
      '',
      MARKER,
      TWO_LINE,
      TYPED_NOTE,
      '<!-- orca-prototype-typed -->',
      '/prototype make a login page'
    ].join('\n')
    expect(splitPrototypeHiddenInstruction(text)).toEqual({
      visibleText: '/prototype make a login page',
      hidden: { kind: 'request', requestId: REQUEST_ID }
    })
  })

  it('ignores a typed marker that comes before the request marker', () => {
    const text = `hello\n<!-- orca-prototype-typed -->\nthere\n${MARKER}\nProduce`
    expect(splitPrototypeHiddenInstruction(text).visibleText).toBe(
      'hello\n<!-- orca-prototype-typed -->\nthere'
    )
  })

  it('needs the marker to be a whole line', () => {
    const inline = `see ${MARKER} here`
    expect(splitPrototypeHiddenInstruction(inline)).toEqual({ visibleText: inline })
  })

  it.each([
    '<!-- orca-prototype-request: -->',
    '<!-- orca-prototype-request:bad id -->',
    '<!-- orca-prototype-request:abc:B -->',
    '<!-- orca-prototype-iteration:abc -->',
    '<!-- orca-prototype-iteration:abc:b -->',
    '<!-- orca-prototype-other:abc -->'
  ])('does not read %j as a marker', (line) => {
    const text = `hello\n\n${line}\nrest`
    expect(splitPrototypeHiddenInstruction(text)).toEqual({ visibleText: text })
  })
})
