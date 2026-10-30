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
  'Arregla el bug. Diseña una nueva versión de la pantalla de pagos',
  'Crea una sesión hija que diseñe una nueva versión de la pantalla de NexusCare donde actualmente se procesan las liquidaciones en la fase 1, 2 y 3.',
  'Quiero que diseñemos el dashboard de ventas del mes',
  'Necesito que diseñen el formulario de alta de clientes',
  'Diseñando la pantalla de ajustes ahora mismo',
  'Le pedí que rediseñe la pantalla de facturación',
  'Rediseñemos la landing con más aire',
  'Hazme un boceto de la pantalla de login',
  'Haz un bosquejo de la landing page',
  'Maquetar la pantalla de login para móvil',
  'Maquetación de la pantalla de pagos con tres columnas',
  'Quiero que prototipe la pantalla de cobros',
  'Let us start prototyping the checkout',
  'Some wireframing for the onboarding screens, please',
  'Hire a designer to design the new screen of the app',
  'Desing a new login screen',
  'Diseniar la pantalla de inicio',
  'Rediseno la pantala de ajustes',
  'dsign the screen for the new flow',
  'deisgn the settings screen',
  'Desgin the pantalla de cobros'
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
  'design the whole new login flow for our users and then add one modal',
  'Diseño de base de datos para la pantalla de cobros',
  'system design for the screen of the app',
  'design doc for the screen of the app',
  'Designa al responsable de la pantalla',
  'Resign from the screen of the app',
  'Diseña la lista de precios',
  'Diseña los pagos del mes',
  'design the model and the terms',
  'design menos cosas de la app',
  'Diseña la pantalla de la base de datos de cobros',
  'Diseñamos el sistema de pagos para la API'
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

describe('hasPrototypeKeyword typo tolerance', () => {
  it.each([
    'dezign the screen',
    'desgin the screen',
    'design the scren',
    'pnatalla de ajustes diseña'
  ])('accepts the one-edit typo %j', (text) => {
    expect(hasPrototypeKeyword(text)).toBe(true)
  })

  it.each([
    'Resigned from the screen of the app',
    'We are resigning the screen of the app',
    'The founder resigns the screen of the app',
    'Designar la pantalla de ajustes',
    'Designaron la pantalla de ajustes',
    'La designación de la pantalla de ajustes'
  ])('keeps the real word family of %j off design words', (text) => {
    expect(hasPrototypeKeyword(text)).toBe(false)
  })

  it.each(['desing the screen', 'diseniar la pantalla', 'desgin the screen'])(
    'still reads the genuine typo %j as a design word',
    (text) => {
      expect(hasPrototypeKeyword(text)).toBe(true)
    }
  )

  it.each(['design the sren', 'desgnr the screen', 'dezain the screen', 'Diseña el pagos'])(
    'does not stretch %j beyond one edit or below five letters',
    (text) => {
      expect(hasPrototypeKeyword(text)).toBe(false)
    }
  )
})

describe('hasPrototypeKeyword on a long message', () => {
  it('scans in time that grows with its words, not with every design word times every noun', () => {
    const designs = Array.from({ length: 40_000 }, () => 'design').join(' ')
    const filler = Array.from({ length: 15 }, (_, index) => `filler${index}`).join(' ')
    const pages = Array.from({ length: 40_000 }, () => 'page').join(' ')
    const started = performance.now()

    expect(hasPrototypeKeyword(`${designs} ${filler} ${pages}`)).toBe(false)
    expect(performance.now() - started).toBeLessThan(2_000)
  })
})
