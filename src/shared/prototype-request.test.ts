import { describe, expect, it } from 'vitest'
import {
  buildPrototypeIterationInstruction,
  buildPrototypeRequestMessage,
  classifyPrototypeRequest,
  PROTOTYPE_NATIVE_COMMANDS
} from './prototype-request'

const FOLDER = '/work/visuals/prototypes/20261028-201500-k3f9q2'

const TWO_DIRECTIONS = [
  'Produce exactly 2 distinct design directions. Write each as ONE self-contained HTML file with inline CSS and no external network resources, at these exact paths:',
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
  it('sends a /prototype request to Claude as the plain instruction, with its folder', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/prototype make a login page',
        agent: 'claude',
        count: 2,
        folderPath: FOLDER
      })
    ).toEqual({
      visibleText: '/prototype make a login page',
      sentText: `make a login page\n\n${TWO_DIRECTIONS}`
    })
  })

  it('translates /prototype on Gentle Shell into its design command, with no folder', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/prototype make a login page',
        agent: 'gentle-shell',
        count: 3,
        folderPath: FOLDER
      })
    ).toEqual({
      visibleText: '/prototype make a login page',
      sentText: '/gentle:design make a login page\n\nProduce 3 distinct design directions.'
    })
    expect(
      buildPrototypeRequestMessage({
        text: '/prototipo',
        agent: 'gentle-shell',
        count: 1,
        folderPath: FOLDER
      }).sentText
    ).toBe('/gentle:design\n\nProduce 1 design direction.')
  })

  it('sends /prototype on Gentle Shell as the plain instruction when it would be a control subcommand', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/prototype stop',
        agent: 'gentle-shell',
        count: 2,
        folderPath: FOLDER
      }).sentText
    ).toBe(`stop\n\n${TWO_DIRECTIONS}`)
  })

  it('leaves a typed Gentle Shell design command as written and adds the count line', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/gentle:design make a login page',
        agent: 'gentle-shell',
        count: 2,
        folderPath: FOLDER
      })
    ).toEqual({
      visibleText: '/gentle:design make a login page',
      sentText: '/gentle:design make a login page\n\nProduce 2 distinct design directions.'
    })
  })

  it('sends a typed native command of another agent as written, with the folder instruction', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/design a login page',
        agent: 'claude',
        count: 2,
        folderPath: FOLDER
      }).sentText
    ).toBe(`/design a login page\n\n${TWO_DIRECTIONS}`)
  })

  it('sends a keyword request trimmed, with the folder instruction, and shows the text as typed', () => {
    const message = buildPrototypeRequestMessage({
      text: '  Make a mockup of the page \n',
      agent: 'codex',
      count: 3,
      folderPath: FOLDER
    })
    expect(message.visibleText).toBe('  Make a mockup of the page \n')
    expect(message.sentText.startsWith('Make a mockup of the page\n\nProduce exactly 3')).toBe(true)
    expect(message.sentText).toContain(`${FOLDER}/C.html`)
    expect(message.sentText).not.toContain('D.html')
  })

  it('uses the singular wording and one file for a single direction', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/prototype a login page',
        agent: 'codex',
        count: 1,
        folderPath: FOLDER
      }).sentText
    ).toBe(
      [
        'a login page',
        '',
        'Produce 1 design direction. Write it as a single self-contained HTML file with inline CSS and no external network resources, at this exact path:',
        `${FOLDER}/A.html`,
        'Write nothing else in that folder. Do not announce this file as a chat visual. Reply with one line: its letter, a short name, and a one-line tradeoff.'
      ].join('\n')
    )
  })

  it('clamps the count to four directions, A to D', () => {
    const { sentText } = buildPrototypeRequestMessage({
      text: 'make a mockup',
      agent: 'other',
      count: 9,
      folderPath: FOLDER
    })
    expect(sentText).toContain('Produce exactly 4 distinct design directions.')
    expect(sentText).toContain(`${FOLDER}/D.html`)
    expect(sentText).not.toContain('E.html')
  })

  it('adds the Stitch line for Antigravity only', () => {
    const antigravity = buildPrototypeRequestMessage({
      text: '/prototype make a login page',
      agent: 'antigravity',
      count: 2,
      folderPath: FOLDER
    }).sentText
    const claude = buildPrototypeRequestMessage({
      text: '/prototype make a login page',
      agent: 'claude',
      count: 2,
      folderPath: FOLDER
    }).sentText
    expect(
      antigravity.endsWith(
        '\nDo not use Stitch MCP for this request; write the local HTML files instead.'
      )
    ).toBe(true)
    expect(claude).not.toContain('Stitch')
  })

  it('sends no leading blank lines when /prototype has no text', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '/prototype',
        agent: 'codex',
        count: 2,
        folderPath: FOLDER
      }).sentText.startsWith('Produce exactly 2 distinct design directions.')
    ).toBe(true)
  })

  it('returns text without a request exactly as it was', () => {
    expect(
      buildPrototypeRequestMessage({
        text: '  fix the build  ',
        agent: 'claude',
        count: 2,
        folderPath: FOLDER
      })
    ).toEqual({ visibleText: '  fix the build  ', sentText: '  fix the build  ' })
  })

  it('keeps the separators of a Windows folder and joins the file name with a slash', () => {
    const { sentText } = buildPrototypeRequestMessage({
      text: '/prototype a login',
      agent: 'codex',
      count: 1,
      folderPath: 'C:\\work\\visuals\\prototypes\\req\\'
    })
    expect(sentText).toContain('C:\\work\\visuals\\prototypes\\req/A.html')
  })

  it('needs a folder path to write the direction files', () => {
    expect(() =>
      buildPrototypeRequestMessage({
        text: '/prototype a login',
        agent: 'claude',
        count: 2,
        folderPath: ''
      })
    ).toThrow(RangeError)
  })
})

describe('buildPrototypeIterationInstruction', () => {
  it('names the new version file of the direction and forbids other edits', () => {
    expect(
      buildPrototypeIterationInstruction({ letter: 'B', nextVersion: 2, folderPath: FOLDER })
    ).toBe(
      `Write the new version of direction B as ${FOLDER}/B-v2.html, self-contained with inline CSS and no external network resources, and do not modify other files.`
    )
  })

  it.each([
    { label: 'a lowercase letter', letter: 'b', nextVersion: 2 },
    { label: 'two letters', letter: 'AA', nextVersion: 2 },
    { label: 'version 1', letter: 'B', nextVersion: 1 },
    { label: 'a fractional version', letter: 'B', nextVersion: 2.5 }
  ])('rejects $label', ({ letter, nextVersion }) => {
    expect(() =>
      buildPrototypeIterationInstruction({ letter, nextVersion, folderPath: FOLDER })
    ).toThrow(RangeError)
  })
})
