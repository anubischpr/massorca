import { describe, expect, it } from 'vitest'
import { botTeamGreetingLine, isBotTeamGreeting } from './bot-team-greeting'

describe('isBotTeamGreeting', () => {
  it.each([
    'Hola',
    'Hola!',
    '¡Hola!',
    'holaaa',
    'Buenos días',
    'buen día 👋',
    'Buenas tardes!',
    'Hi',
    'Hello!!',
    'Good morning',
    'Hola team',
    'Hola equipo'
  ])('takes %s as a greeting', (text) => {
    expect(isBotTeamGreeting(text)).toBe(true)
  })

  it.each([
    'Hola, revisa esto',
    'Hi, can you check the flyer?',
    'Buenos días, en qué nos quedamos?',
    'hospital',
    ''
  ])('takes %s as a real message', (text) => {
    expect(isBotTeamGreeting(text)).toBe(false)
  })
})

describe('botTeamGreetingLine', () => {
  it('answers in the language of the greeting', () => {
    const first = () => 0
    expect(botTeamGreetingLine({ text: 'Hola', random: first })).toMatch(/^Hola!/)
    expect(botTeamGreetingLine({ text: 'Hello', random: first })).toMatch(/^Hello!/)
  })

  it('varies its symbols and emoji', () => {
    const lines = new Set(Array.from({ length: 60 }, () => botTeamGreetingLine({ text: 'Hola' })))
    expect(lines.size).toBeGreaterThan(5)
  })

  it('never repeats the last line, even when chance would', () => {
    const first = () => 0
    const previous = botTeamGreetingLine({ text: 'Hola', random: first })
    expect(botTeamGreetingLine({ text: 'Hola', previous, random: first })).not.toBe(previous)
  })
})
