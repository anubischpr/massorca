import { describe, expect, it } from 'vitest'
import { asksForDelegatedSession } from './prototype-delegated-ask'

describe('asksForDelegatedSession', () => {
  it.each([
    'Crea una sesión hija que diseñe la pantalla de ajustes',
    'crea una sesion hija para el login',
    'Haz esto en una child session',
    'Usa un subagente para el mockup',
    'Use a subagent for the mockup',
    'Delega en otra sesión el diseño del login',
    'Delegate the login design to a new session'
  ])('finds a hand-off to a child session or subagent in %j', (text) => {
    expect(asksForDelegatedSession(text)).toBe(true)
  })

  it.each([
    'Diseña la pantalla de ajustes',
    'Make a mockup of the pricing page',
    'Sesión de trabajo con el equipo de diseño',
    'Delegation of the design to the team'
  ])('finds no hand-off in %j', (text) => {
    expect(asksForDelegatedSession(text)).toBe(false)
  })
})
