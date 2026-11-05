import { describe, expect, it } from 'vitest'
import { asksForUniversalBotCapability, isBotTeamActionRequest } from './bot-team-request-action'

describe('isBotTeamActionRequest', () => {
  it.each([
    'Crea una tarjeta de opciones para el menú',
    'por favor genera un informe',
    '¿Puedes crear un artefacto con el resumen?',
    'Make a flyer',
    'hola, haz una presentación'
  ])('reads %s as an order', (text) => {
    expect(isBotTeamActionRequest(text)).toBe(true)
  })

  it.each([
    '¿Cómo creo una tarjeta?',
    'What did we last see in NexusCare?',
    'ya terminaste el informe?',
    'gracias',
    'The flyer is ready, make sure to check it',
    'guarda silencio',
    'save me a seat'
  ])('does not read %s as an order', (text) => {
    expect(isBotTeamActionRequest(text)).toBe(false)
  })
})

describe('asksForUniversalBotCapability', () => {
  it('knows option cards and artifacts, in either language', () => {
    expect(asksForUniversalBotCapability('crea una tarjeta de opciones')).toBe(true)
    expect(asksForUniversalBotCapability('Create an option card')).toBe(true)
    expect(asksForUniversalBotCapability('arma un artefacto')).toBe(true)
    expect(asksForUniversalBotCapability('guarda este archivo para referencias')).toBe(true)
    expect(asksForUniversalBotCapability('Make a flyer')).toBe(false)
  })
})
