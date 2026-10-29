// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseComponentsHtml } from '../../../../shared/prototype-design-system-components'
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
import { PrototypeDesignSystemPalettes } from './PrototypeDesignSystemPalettes'
import { PrototypeBuiltOnLink } from './PrototypeBuiltOnLink'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' } },
  type: {
    family: { $value: 'Geist', $type: 'fontFamily' },
    display: { $value: '32px' },
    title: { $value: '20px' },
    body: { $value: '14px' },
    caption: { $value: '12px' }
  },
  radius: { md: { $value: '8px' } },
  space: { '1': { $value: '4px' } },
  $extensions: {
    massorca: {
      version: 1,
      status: 'proposed',
      agent: 'Codex',
      palettes: [
        {
          id: 'A',
          name: 'Calm blue',
          note: 'Neutral grays, one blue accent for actions',
          swatches: ['#2563eb', '#0f172a', '#f8fafc', '#16a34a'],
          tokens: {}
        },
        {
          id: 'B',
          name: 'Warm clay',
          note: 'Off-white ground, clay accent, softer contrast',
          swatches: ['#c2410c', '#1c1917', '#fafaf9', '#15803d'],
          tokens: {}
        }
      ]
    }
  }
})

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: 'landing',
  projectName: 'landing-site',
  status: 'proposed',
  version: 1,
  tokenCount: 7,
  agent: 'Codex',
  swatches: []
}

const TARGET: PrototypeListedSet = {
  requestId: '20261028-201500-aaaaaa',
  sessionId: 'session-alpha-0001',
  agent: 'codex',
  worktreeId: null,
  chatTitle: 'Landing',
  originalPrompt: 'a landing page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 2,
  directions: [],
  projectKey: 'landing',
  projectName: 'landing-site',
  folderPath: '/state/landing'
}

function content(): DesignSystemContent {
  const parsed = parseDesignTokens(TOKENS)
  const components = parseComponentsHtml('')
  return {
    tokens: parsed?.tokens ?? [],
    meta: parsed?.meta ?? { history: [], sources: [], palettes: [] },
    components: components.sections,
    styleBlock: components.styleBlock
  }
}

function renderPalettes(
  overrides: {
    state?: Partial<DesignSystemViewState>
    target?: PrototypeListedSet | undefined
    update?: DesignSystemPanelProps['update']
    runSend?: DesignSystemPanelProps['runSend']
  } = {}
): { update: DesignSystemPanelProps['update']; runSend: DesignSystemPanelProps['runSend'] } {
  const update = overrides.update ?? vi.fn()
  const runSend =
    overrides.runSend ??
    vi.fn<(kind: DesignSystemSendKind, text: string) => Promise<void>>(async () => undefined)
  render(
    <PrototypeDesignSystemPalettes
      system={SYSTEM}
      content={content()}
      state={{ ...emptyDesignSystemViewState(), ...overrides.state }}
      update={update}
      target={'target' in overrides ? overrides.target : TARGET}
      rebuildSets={[]}
      runSend={runSend}
    />
  )
  return { update, runSend }
}

function lastUpdate(
  update: DesignSystemPanelProps['update'],
  base: DesignSystemViewState
): DesignSystemViewState {
  const transform = vi.mocked(update).mock.calls.at(-1)?.[0]
  return transform === undefined ? base : transform(base)
}

describe('PrototypeDesignSystemPalettes', () => {
  afterEach(cleanup)

  it('lists each palette with its swatches and note, and marks the first one chosen', () => {
    renderPalettes()
    expect(screen.getByText('Pick a palette')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Calm blue/u })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /^Warm clay/u })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(screen.getByText('Neutral grays, one blue accent for actions')).toBeInTheDocument()
  })

  it('chooses a palette through the state when its card is picked', async () => {
    const user = userEvent.setup()
    const { update } = renderPalettes()
    await user.click(screen.getByRole('button', { name: /^Warm clay/u }))
    expect(lastUpdate(update, emptyDesignSystemViewState()).palette).toBe('B')
  })

  it('states the type, radius and spacing the palettes come with, from the tokens', () => {
    renderPalettes()
    expect(
      screen.getByText('Type: Geist 32/20/14/12 · radius 8 · spacing 4-based')
    ).toBeInTheDocument()
  })

  it('approves the chosen palette in the chat, naming the target set’s request', async () => {
    const user = userEvent.setup()
    const { runSend } = renderPalettes({ state: { palette: 'B' } })
    await user.click(screen.getByRole('button', { name: 'Approve Warm clay' }))
    expect(runSend).toHaveBeenCalledWith(
      'palette',
      expect.stringContaining('Use the Warm clay palette for the design system.')
    )
    expect(runSend).toHaveBeenCalledWith(
      'palette',
      expect.stringContaining(`prototype request ${TARGET.requestId}`)
    )
  })

  it('holds Approve when no chat of the project can take it', () => {
    renderPalettes({ target: undefined })
    expect(screen.getByRole('button', { name: 'Approve Calm blue' })).toBeDisabled()
  })

  it('opens the Tokens tab from Adjust tokens', async () => {
    const user = userEvent.setup()
    const { update } = renderPalettes()
    await user.click(screen.getByRole('button', { name: 'Adjust tokens' }))
    expect(lastUpdate(update, emptyDesignSystemViewState()).tab).toBe('tokens')
  })

  it('shows the approval failure under the buttons', () => {
    renderPalettes({ state: { failed: 'palette' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Your draft is kept.')
  })
})

describe('PrototypeDesignSystemAside for a proposed system', () => {
  afterEach(cleanup)

  it('puts the palette review in place of the selection while the system is proposed', () => {
    render(
      <PrototypeDesignSystemAside
        system={SYSTEM}
        content={content()}
        state={{
          ...emptyDesignSystemViewState(),
          selection: { kind: 'token', id: 'color.primary' }
        }}
        update={vi.fn()}
        target={TARGET}
        rebuildSets={[]}
        runSend={vi.fn(async () => undefined)}
      />
    )
    expect(screen.getByText('Pick a palette')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Hex' })).toBeNull()
  })
})

describe('PrototypeBuiltOnLink', () => {
  afterEach(cleanup)

  it('names the design system version the set was built on and opens its view', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<PrototypeBuiltOnLink version={2} onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Built on Design system v2 ›' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
