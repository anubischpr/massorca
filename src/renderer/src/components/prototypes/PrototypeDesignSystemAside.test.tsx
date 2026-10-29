// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseComponentsHtml } from '../../../../shared/prototype-design-system-components'
import {
  emptyDesignSystemDraft,
  setDraftTokenValue
} from '../../../../shared/prototype-design-system-draft'
import { parseDesignTokens } from '../../../../shared/prototype-design-system-tokens'
import {
  emptyDesignSystemViewState,
  type DesignSystemSendKind,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import type { DesignSystemContent, DesignSystemPanelProps } from './prototype-design-system-props'
import { PrototypeDesignSystemAside } from './PrototypeDesignSystemAside'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' }, border: { $value: '#e5e5e5' } },
  radius: { md: { $value: '8px' } },
  $extensions: { massorca: { version: 2, status: 'detected', agent: 'Codex' } }
})

const COMPONENTS = [
  '<style>.btn{}</style>',
  '<section data-component="Button" data-variants="primary" data-variant-options="primary secondary" data-bind-background="color.primary" data-bind-radius="radius.md"><button>Go</button></section>'
].join('\n')

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: 'nexus',
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 3,
  agent: 'Codex',
  swatches: ['#2563eb', '#e5e5e5']
}

const TARGET: PrototypeListedSet = {
  requestId: 'r1',
  sessionId: 'session-alpha-0001',
  agent: 'codex',
  worktreeId: null,
  chatTitle: 'Checkout',
  originalPrompt: 'a checkout page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 1,
  directions: [{ letter: 'A', versions: [{ version: 2, fileName: 'A-2.html', mtime: 1 }] }],
  projectKey: 'nexus',
  projectName: 'nexuscare',
  folderPath: '/state/r1'
}

const REBUILT: PrototypeListedSet = {
  ...TARGET,
  requestId: 'r0',
  chatTitle: 'Liquidaciones fases 1–3',
  builtOn: 2,
  folderPath: '/state/r0'
}

function content(): DesignSystemContent {
  const parsed = parseDesignTokens(TOKENS)
  const components = parseComponentsHtml(COMPONENTS)
  return {
    tokens: parsed?.tokens ?? [],
    meta: parsed?.meta ?? { history: [], sources: [], palettes: [] },
    components: components.sections,
    styleBlock: components.styleBlock
  }
}

function renderAside(
  overrides: {
    state?: Partial<DesignSystemViewState>
    target?: PrototypeListedSet | undefined
    rebuildSets?: PrototypeListedSet[]
    update?: DesignSystemPanelProps['update']
    runSend?: DesignSystemPanelProps['runSend']
  } = {}
): { update: DesignSystemPanelProps['update']; runSend: DesignSystemPanelProps['runSend'] } {
  const update = overrides.update ?? vi.fn()
  const runSend =
    overrides.runSend ??
    vi.fn<(kind: DesignSystemSendKind, text: string) => Promise<void>>(async () => undefined)
  render(
    <PrototypeDesignSystemAside
      system={SYSTEM}
      content={content()}
      state={{ ...emptyDesignSystemViewState(), ...overrides.state }}
      update={update}
      target={'target' in overrides ? overrides.target : TARGET}
      rebuildSets={overrides.rebuildSets ?? []}
      runSend={runSend}
    />
  )
  return { update, runSend }
}

// The state a transform makes from a base state, so a test checks what the last update did.
function lastUpdate(
  update: DesignSystemPanelProps['update'],
  base: DesignSystemViewState
): DesignSystemViewState {
  const transform = vi.mocked(update).mock.calls.at(-1)?.[0]
  return transform === undefined ? base : transform(base)
}

describe('PrototypeDesignSystemAside draft', () => {
  afterEach(cleanup)

  it('counts the draft items and groups a token change under the tokens group', () => {
    const draft = setDraftTokenValue(
      emptyDesignSystemDraft(),
      { id: 'color.primary', group: 'color', name: 'primary', type: 'color', value: '#2563eb' },
      '#1d4ed8'
    )
    renderAside({ state: { draft, selection: null } })
    expect(screen.getByText('1 items')).toBeInTheDocument()
    expect(screen.getByText('Design system · tokens')).toBeInTheDocument()
    expect(screen.getByText('color.primary #2563eb → #1d4ed8')).toBeInTheDocument()
  })

  it('holds Send until the draft has an item or words, and disables it with no chat to take it', () => {
    renderAside()
    expect(screen.getByRole('button', { name: 'Send to Codex' })).toBeDisabled()
    cleanup()
    renderAside({ state: { freeText: 'Calmer.' }, target: undefined })
    expect(screen.getByRole('button', { name: 'Send to Codex' })).toBeDisabled()
  })

  it('sends the one message through the chat as the draft kind, with the words typed under it', async () => {
    const user = userEvent.setup()
    const { runSend } = renderAside({ state: { freeText: 'Tone: calm.' } })
    await user.click(screen.getByRole('button', { name: 'Send to Codex' }))
    expect(runSend).toHaveBeenCalledWith(
      'draft',
      expect.stringContaining('Update the design system to v3.')
    )
    expect(runSend).toHaveBeenCalledWith('draft', expect.stringContaining('Tone: calm.'))
  })

  it('offers to rebuild the sets built on this version, and names them in the message and its line', () => {
    const draft = setDraftTokenValue(
      emptyDesignSystemDraft(),
      { id: 'color.primary', group: 'color', name: 'primary', type: 'color', value: '#2563eb' },
      '#1d4ed8'
    )
    renderAside({ state: { draft }, rebuildSets: [REBUILT] })
    expect(
      screen.getByText(
        'Also rebuild the sets built on v2 (Liquidaciones fases 1–3) with the new tokens and components'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Rebuild Liquidaciones fases 1–3 on v3\./u, { selector: 'span' })
    ).toBeInTheDocument()
  })

  it('takes the rebuild off through the state when its option is unchecked', async () => {
    const user = userEvent.setup()
    const { update } = renderAside({
      state: { freeText: 'x', rebuild: true },
      rebuildSets: [REBUILT]
    })
    await user.click(screen.getByRole('checkbox'))
    expect(lastUpdate(update, emptyDesignSystemViewState()).rebuild).toBe(false)
  })

  it('shows the draft’s send failure and keeps the words under it', () => {
    renderAside({ state: { freeText: 'Calmer.', failed: 'draft' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Your draft is kept.')
    expect(screen.getByDisplayValue('Calmer.')).toBeInTheDocument()
  })
})

describe('PrototypeDesignSystemAside token selection', () => {
  afterEach(cleanup)

  it('names the token, what uses it, and shows its swatches and hex', () => {
    renderAside({
      state: { selection: { kind: 'token', id: 'color.primary' } },
      rebuildSets: [REBUILT]
    })
    expect(screen.getByText('color.primary')).toBeInTheDocument()
    expect(screen.getByText('Used by 1 components · 1 sets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color #2563eb' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Hex' })).toHaveValue('#2563eb')
    expect(
      screen.getByText('Changes preview on Components and join the draft on their own.')
    ).toBeInTheDocument()
  })

  it('commits a complete hex color typed into the hex field', async () => {
    const user = userEvent.setup()
    const { update } = renderAside({ state: { selection: { kind: 'token', id: 'color.primary' } } })
    const hex = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(hex)
    await user.type(hex, '#1d4ed8')
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.values).toEqual({
      'color.primary': '#1d4ed8'
    })
  })

  it('opens the color picker from the custom swatch, on the color’s own hue', async () => {
    const user = userEvent.setup()
    const { update } = renderAside({ state: { selection: { kind: 'token', id: 'color.primary' } } })
    await user.click(screen.getByRole('button', { name: 'Custom color' }))
    expect(lastUpdate(update, emptyDesignSystemViewState())).toMatchObject({
      pickerOpen: true,
      pickerHue: 210
    })
  })

  it('edits a size token through its value field', () => {
    const { update } = renderAside({ state: { selection: { kind: 'token', id: 'radius.md' } } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), { target: { value: '10px' } })
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.values).toEqual({
      'radius.md': '10px'
    })
  })
})

describe('PrototypeDesignSystemAside component selection', () => {
  afterEach(cleanup)

  it('shows the first component when nothing is chosen, with its variant chips and bindings', () => {
    renderAside()
    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'primary' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'secondary' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByRole('button', { name: 'color.border' })).toBeInTheDocument()
  })

  it('toggles a variant and binds a property to another token of its group, through the draft', async () => {
    const user = userEvent.setup()
    const { update } = renderAside()
    await user.click(screen.getByRole('button', { name: 'secondary' }))
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.comps).toEqual({
      Button: { variants: ['primary', 'secondary'] }
    })
    await user.click(screen.getByRole('button', { name: 'color.border' }))
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.comps).toEqual({
      Button: { bindings: { background: 'color.border' } }
    })
  })

  it('writes a note and marks the component for removal through the draft', async () => {
    const user = userEvent.setup()
    const { update } = renderAside()
    fireEvent.change(screen.getByRole('textbox', { name: /Note/u }), {
      target: { value: 'Pill shape' }
    })
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.notes).toEqual({
      Button: 'Pill shape'
    })
    await user.click(screen.getByRole('button', { name: 'Remove component' }))
    expect(lastUpdate(update, emptyDesignSystemViewState()).draft.removed).toEqual({ Button: true })
  })
})
