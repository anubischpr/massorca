import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isFloatingWorkspacePanelShortcut,
  matchFloatingWorkspacePanelOwnedAction
} from './floating-workspace-shortcut-policy'

type ChordEvent = Parameters<typeof matchFloatingWorkspacePanelOwnedAction>[0]

function makeChordEvent(overrides: {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  target: EventTarget | null
}): ChordEvent {
  return {
    altKey: false,
    code: `Key${overrides.key.toUpperCase()}`,
    ctrlKey: false,
    metaKey: false,
    shiftKey: true,
    ...overrides
  }
}

function makePanelElement(): HTMLElement {
  const element = {
    classList: { contains: vi.fn(() => false) },
    closest: vi.fn((selector: string) =>
      selector === '[data-floating-terminal-panel]' ? element : null
    ),
    getAttribute: vi.fn((name: string) => (name === 'data-floating-terminal-panel' ? '' : null))
  }
  Object.setPrototypeOf(element, HTMLElement.prototype)
  return element as unknown as HTMLElement
}

function makeOutsideElement(): HTMLElement {
  const element = {
    classList: { contains: vi.fn(() => false) },
    closest: vi.fn(() => null),
    getAttribute: vi.fn(() => null)
  }
  Object.setPrototypeOf(element, HTMLElement.prototype)
  return element as unknown as HTMLElement
}

describe('floating panel chord ownership', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLElement', class {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('claims Mod+Shift+H as the checklist action and Mod+Shift+Y as the session action', () => {
    const target = makePanelElement()
    const context = { context: 'app' as const }

    expect(
      matchFloatingWorkspacePanelOwnedAction(
        makeChordEvent({ key: 'h', metaKey: true, target }),
        'darwin',
        undefined,
        context
      )
    ).toBe('tab.newChecklist')
    expect(
      matchFloatingWorkspacePanelOwnedAction(
        makeChordEvent({ key: 'h', ctrlKey: true, target }),
        'win32',
        undefined,
        context
      )
    ).toBe('tab.newChecklist')
    expect(
      matchFloatingWorkspacePanelOwnedAction(
        makeChordEvent({ key: 'y', metaKey: true, target }),
        'darwin',
        undefined,
        context
      )
    ).toBe('tab.openSession')
    expect(
      matchFloatingWorkspacePanelOwnedAction(
        makeChordEvent({ key: 'y', ctrlKey: true, target }),
        'linux',
        undefined,
        context
      )
    ).toBe('tab.openSession')
  })

  it('claims the chords only when the event comes from inside the floating panel', () => {
    const context = { context: 'app' as const }

    expect(
      isFloatingWorkspacePanelShortcut(
        makeChordEvent({ key: 'h', ctrlKey: true, target: makePanelElement() }),
        'win32',
        null,
        undefined,
        context
      )
    ).toBe(true)
    expect(
      isFloatingWorkspacePanelShortcut(
        makeChordEvent({ key: 'y', ctrlKey: true, target: makePanelElement() }),
        'win32',
        null,
        undefined,
        context
      )
    ).toBe(true)
    expect(
      isFloatingWorkspacePanelShortcut(
        makeChordEvent({ key: 'h', ctrlKey: true, target: makeOutsideElement() }),
        'win32',
        null,
        undefined,
        context
      )
    ).toBe(false)
  })
})
