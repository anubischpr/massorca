import { describe, expect, it } from 'vitest'
import {
  hasPrototypeKeyword,
  PROTOTYPE_DESIGN_TERMS,
  PROTOTYPE_NEGATIVE_TERMS,
  PROTOTYPE_POSITIVE_TERMS,
  PROTOTYPE_UI_NOUNS
} from './prototype-request-lexicon'

const PROTOTYPE_REQUESTS = [
  'diseña la pantalla de login',
  'hazme un prototipo del checkout',
  'rediseña la landing',
  'Necesito una maqueta de la app',
  'Quiero diseñar el nuevo menú de navegación',
  'Diseñame un formulario de registro',
  'Hace un rediseño del botón principal',
  'Haz dos mockups de la página de precios',
  'Dibuja wireframes para el onboarding',
  'Need a mock-up of the settings view',
  'Make three prototypes of the pricing page',
  'Let us design the settings screen',
  'We need a design for the landing page',
  'Redesign the checkout modal',
  'Show me two designs of the dashboard',
  'Hay que diseñar la vista principal',
  'Diseño de la pantalla de pago',
  'Quiero diseños para el componente de tarjeta',
  'DISEÑA LA PANTALLA DE INICIO',
  'disena la pantalla',
  'diseña una nueva versión de la pantalla de NexusCare donde actualmente se procesan las liquidaciones en la fase 1, 2 y 3.',
  'Diseña una nueva versión de la pantalla de NexusCare donde actualmente se procesan las liquidaciones',
  'Diseña, con mucho cuidado, una nueva pantalla de ajustes',
  'Rediseña por favor la versión actual de la pantalla de facturación de los clientes',
  'Please design a new version of the screen for NexusCare where claims are currently processed in phases 1, 2 and 3.',
  'Can you redesign the current version of the page where users review their settings and billing?',
  'Arregla el bug. Diseña una nueva versión de la pantalla de pagos'
]

const NOT_PROTOTYPE_REQUESTS = [
  'diseño de la base de datos',
  'design doc for the API',
  'system design interview',
  'diseña la pantalla de la base de datos',
  'Make a prototype of the API endpoint',
  'Make a mockup of the database schema',
  'Review the data model for the checkout',
  'What is a design pattern?',
  'Explica el patrón de diseño del módulo',
  'Explain the software design of the module',
  'Escribe el documento de diseño del módulo',
  'Arregla el esquema de la base de datos',
  'Diseño técnico de la pantalla',
  'Plan the modelo de datos y la arquitectura',
  'Hay que diseñar el formulario de la API',
  'Let us talk about designing software architecture',
  'Necesito un diseño para el login',
  'Fix the failing build',
  'I am a designer',
  'the redesigned page',
  'open design_tokens.ts',
  'design the new login flow with a modal',
  'Document the endpoints for the dashboard',
  'Diseña una nueva versión de la base de datos donde se guardan las liquidaciones para la pantalla de NexusCare',
  'Design the new architecture of the service that processes claims in phases 1, 2 and 3, then show the screen',
  'Diseña el sistema. La pantalla de NexusCare ya existe y funciona bien en fase 1, 2 y 3',
  'design the whole new login flow for our users and then add one modal'
]

describe('hasPrototypeKeyword', () => {
  it.each(PROTOTYPE_REQUESTS)('reads %j as a prototype request', (text) => {
    expect(hasPrototypeKeyword(text)).toBe(true)
  })

  it.each(NOT_PROTOTYPE_REQUESTS)('does not read %j as a prototype request', (text) => {
    expect(hasPrototypeKeyword(text)).toBe(false)
  })

  it('counts a UI noun ten words away in the same sentence, but not eleven or across sentences', () => {
    expect(hasPrototypeKeyword('design one two three four five six seven eight nine modal')).toBe(
      true
    )
    expect(
      hasPrototypeKeyword('design one two three four five six seven eight nine ten modal')
    ).toBe(false)
    expect(hasPrototypeKeyword('design this. The modal is fine')).toBe(false)
  })

  it('does not read a flow between the design word and the noun as a screen request', () => {
    expect(hasPrototypeKeyword('design the new login flow modal')).toBe(false)
    expect(hasPrototypeKeyword('design the new login modal')).toBe(true)
  })
})

describe('lexicon terms', () => {
  it.each(PROTOTYPE_POSITIVE_TERMS)('matches the term %j on its own', (term) => {
    expect(hasPrototypeKeyword(term)).toBe(true)
  })

  it.each(PROTOTYPE_DESIGN_TERMS)('needs a UI noun for the design term %j', (term) => {
    expect(hasPrototypeKeyword(term)).toBe(false)
    expect(hasPrototypeKeyword(`${term} screen`)).toBe(true)
  })

  it.each(PROTOTYPE_UI_NOUNS)('counts the UI noun %j next to a design word', (noun) => {
    expect(hasPrototypeKeyword(`design ${noun}`)).toBe(true)
  })

  it.each(PROTOTYPE_NEGATIVE_TERMS)('suppresses a prototype keyword with %j', (term) => {
    expect(hasPrototypeKeyword(`prototype ${term}`)).toBe(false)
  })

  it('has no blank term, since a blank phrase would match anything', () => {
    const terms = [
      ...PROTOTYPE_POSITIVE_TERMS,
      ...PROTOTYPE_DESIGN_TERMS,
      ...PROTOTYPE_UI_NOUNS,
      ...PROTOTYPE_NEGATIVE_TERMS
    ]
    expect(terms.every((term) => term.trim().length > 0)).toBe(true)
  })
})
