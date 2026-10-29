import { describe, expect, it } from 'vitest'
import {
  PROTOTYPE_NATIVE_COMMANDS,
  buildPrototypePrompt,
  classifyPrototypeRequest
} from './prototype-request'

const countLine = (count: number): string =>
  `Produce ${count} distinct design directions, each a self-contained HTML file, with a one-line tradeoff.`

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
    'Make three prototypes of the pricing page',
    'Hazme un prototipo del checkout',
    'Sketch a mockup of the dashboard',
    'Hazme una maqueta del menú',
    'Draw wireframes for onboarding',
    'Let us design the settings screen',
    'Show me two designs',
    'We are designing a new header',
    'Redesign the footer',
    'Necesito un diseño para el login',
    'Quiero diseños nuevos',
    'Hay que diseñar la home',
    'Diseña la pantalla de pago',
    'Diseñame un formulario',
    'Hace un rediseño del menú',
    'Quiero rediseñar la barra',
    'Rediseña el panel lateral'
  ])('detects a keyword in %j', (text) => {
    expect(classifyPrototypeRequest(text, 'other')).toEqual({ kind: 'keyword' })
  })

  it('ignores accents and case', () => {
    expect(classifyPrototypeRequest('Un DISENO nuevo', 'other')).toEqual({ kind: 'keyword' })
    expect(classifyPrototypeRequest('disenar la home', 'other')).toEqual({ kind: 'keyword' })
    expect(classifyPrototypeRequest('REDISENO del menu', 'other')).toEqual({ kind: 'keyword' })
  })

  it('matches whole words only', () => {
    expect(classifyPrototypeRequest('I am a designer', 'other')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest('the redesigned page', 'other')).toEqual({ kind: 'none' })
    expect(classifyPrototypeRequest('open design_tokens.ts', 'other')).toEqual({ kind: 'none' })
  })

  it('keeps a design word match even for a design doc, since the card filters it', () => {
    expect(classifyPrototypeRequest('Update the design doc', 'other')).toEqual({ kind: 'keyword' })
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

describe('buildPrototypePrompt', () => {
  it('translates /prototype into the native design command of an agent that has one', () => {
    expect(buildPrototypePrompt('/prototype make a login page', 'claude', 2)).toBe(
      `/design make a login page\n\n${countLine(2)}`
    )
    expect(buildPrototypePrompt('/prototipo make a login page', 'gentle-shell', 3)).toBe(
      `/gentle:design make a login page\n\n${countLine(3)}`
    )
  })

  it('sends the plain instruction for /prototype when the agent has no native command', () => {
    expect(buildPrototypePrompt('/prototype make a login page', 'codex', 2)).toBe(
      `make a login page\n\n${countLine(2)}`
    )
    expect(buildPrototypePrompt('/prototype make a login page', 'other', 2)).toBe(
      `make a login page\n\n${countLine(2)}`
    )
  })

  it('never leaves a leading space or blank lines when /prototype has no text', () => {
    expect(buildPrototypePrompt('/prototype', 'claude', 2)).toBe(`/design\n\n${countLine(2)}`)
    expect(buildPrototypePrompt('/prototype', 'codex', 2)).toBe(countLine(2))
  })

  it('keeps a typed native command as written and adds the count line', () => {
    expect(buildPrototypePrompt('/design a login page', 'claude', 2)).toBe(
      `/design a login page\n\n${countLine(2)}`
    )
  })

  it('adds the count line to a keyword request, trimmed', () => {
    expect(buildPrototypePrompt('  make a mockup of the page \n', 'codex', 3)).toBe(
      `make a mockup of the page\n\n${countLine(3)}`
    )
  })

  it('returns text without a request exactly as it was', () => {
    expect(buildPrototypePrompt('  fix the build  ', 'claude', 2)).toBe('  fix the build  ')
  })

  it('asks for the clamped count', () => {
    expect(buildPrototypePrompt('make a mockup', 'other', 9)).toBe(
      `make a mockup\n\n${countLine(4)}`
    )
  })

  it('sends the plain instruction when the native command would start a control subcommand', () => {
    expect(buildPrototypePrompt('/prototype stop', 'gentle-shell', 2)).toBe(
      `stop\n\n${countLine(2)}`
    )
  })

  it('leaves a Gentle Shell control subcommand unchanged', () => {
    expect(buildPrototypePrompt('/gentle:design sync', 'gentle-shell', 2)).toBe(
      '/gentle:design sync'
    )
  })
})
