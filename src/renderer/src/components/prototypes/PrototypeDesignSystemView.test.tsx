// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseComponentsHtml } from '../../../../shared/prototype-design-system-components'
import { parseDesignTokens } from '../../../../shared/prototype-design-system-tokens'
import {
  emptyDesignSystemViewState,
  type DesignSystemViewState
} from '../../../../shared/prototype-design-system-view-state'
import type { PrototypeListedDesignSystem } from '../../../../shared/rpc-contract/prototype-params'
import type { DesignSystemContent, DesignSystemPanelProps } from './prototype-design-system-props'
import { PrototypeDesignSystemView } from './PrototypeDesignSystemView'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? '')),
  getIntlLocale: () => 'en-GB'
}))

const TOKENS = JSON.stringify({
  color: { primary: { $value: '#2563eb' }, border: { $value: '#e5e5e5' } },
  type: {
    family: { $value: 'Geist', $type: 'fontFamily' },
    body: {
      $value: '14px',
      $description: 'Body copy',
      $extensions: { massorca: { weight: 400 } }
    }
  },
  space: { '1': { $value: '4px' } },
  radius: { md: { $value: '8px' } },
  $extensions: {
    massorca: {
      version: 2,
      status: 'detected',
      agent: 'Codex',
      updatedAt: '2026-10-29',
      history: [{ version: 1, status: 'detected', at: '2026-10-21' }],
      sources: [{ path: 'src/assets/main.css', took: ':root and .dark → 8 colors' }]
    }
  }
})

const COMPONENTS = [
  '<style>.btn{border-radius:var(--bind-radius)}</style>',
  '<section data-component="Button" data-variants="primary" data-bind-background="color.primary" data-bind-radius="radius.md"><button class="btn">Go</button></section>',
  '<section data-component="Input" data-variants="default" data-bind-border="color.border"><input /></section>'
].join('\n')

const SYSTEM: PrototypeListedDesignSystem = {
  projectKey: 'nexus',
  projectName: 'nexuscare',
  status: 'detected',
  version: 2,
  tokenCount: 4,
  agent: 'Codex',
  swatches: ['#2563eb', '#e5e5e5']
}

function contentWith(tokensJson: string, componentsHtml: string): DesignSystemContent {
  const parsed = parseDesignTokens(tokensJson)
  const components = parseComponentsHtml(componentsHtml)
  return {
    tokens: parsed?.tokens ?? [],
    meta: parsed?.meta ?? { history: [], sources: [], palettes: [] },
    components: components.sections,
    styleBlock: components.styleBlock
  }
}

function renderView(
  overrides: Partial<Pick<DesignSystemPanelProps, 'content' | 'system' | 'target'>> & {
    state?: Partial<DesignSystemViewState>
    update?: DesignSystemPanelProps['update']
    runSend?: DesignSystemPanelProps['runSend']
  } = {}
): {
  update: DesignSystemPanelProps['update']
  runSend: DesignSystemPanelProps['runSend']
} {
  const update = overrides.update ?? vi.fn()
  const runSend = overrides.runSend ?? vi.fn(async () => undefined)
  render(
    <PrototypeDesignSystemView
      system={overrides.system ?? SYSTEM}
      content={overrides.content ?? contentWith(TOKENS, COMPONENTS)}
      state={{ ...emptyDesignSystemViewState(), ...overrides.state }}
      update={update}
      target={
        'target' in overrides
          ? overrides.target
          : {
              requestId: 'r1',
              sessionId: 'session-alpha-0001',
              agent: 'codex',
              worktreeId: null,
              chatTitle: null,
              originalPrompt: 'a checkout page',
              createdAt: '2026-10-28T20:15:00.000Z',
              count: 1,
              directions: [],
              projectKey: 'nexus',
              projectName: 'nexuscare',
              folderPath: '/state/r1'
            }
      }
      rebuildSets={[]}
      runSend={runSend}
    />
  )
  return { update, runSend }
}

// The state a transform makes from the view's state, so a test checks what an update does.
function stateAfter(update: DesignSystemPanelProps['update'], base: DesignSystemViewState) {
  const mock = vi.mocked(update)
  const transform = mock.mock.calls.at(-1)?.[0]
  return transform === undefined ? base : transform(base)
}

describe('PrototypeDesignSystemView header', () => {
  afterEach(cleanup)

  it('titles the view with its project and lists the file, version, status, agent and sources', () => {
    renderView()
    expect(screen.getByText('Design system · nexuscare')).toBeInTheDocument()
    expect(
      screen.getByText('design/system/tokens.json · v2 · detected by Codex from 1 sources')
    ).toBeInTheDocument()
  })

  it('leaves out the agent and the sources it does not have', () => {
    renderView({ system: { ...SYSTEM, agent: undefined } })
    expect(
      screen.getByText('design/system/tokens.json · v2 · detected from 1 sources')
    ).toBeInTheDocument()
  })

  it('offers the Tokens, Components and Source tabs', () => {
    renderView()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Tokens', 'Components', 'Source'])
  })

  it('switches the open tab when a tab is chosen', async () => {
    const user = userEvent.setup()
    const { update } = renderView({ state: { tab: 'components' } })
    await user.click(screen.getByRole('tab', { name: 'Source' }))
    expect(stateAfter(update, emptyDesignSystemViewState()).tab).toBe('source')
  })
})

describe('PrototypeDesignSystemView Tokens tab', () => {
  afterEach(cleanup)

  it('shows the sections the system has tokens for, and hides the rest', () => {
    renderView({ state: { tab: 'tokens' } })
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Type scale · Geist')).toBeInTheDocument()
    expect(screen.getByText('Spacing')).toBeInTheDocument()
    expect(screen.getByText('Radius')).toBeInTheDocument()
    expect(screen.queryByText('Shadow')).toBeNull()
    expect(screen.queryByText('Motion')).toBeNull()
  })

  it('samples a type token with its description, and captions it with its size and weight', () => {
    renderView({ state: { tab: 'tokens' } })
    expect(screen.getByText('Body copy')).toBeInTheDocument()
    expect(screen.getByText('type.body · 14px/400')).toBeInTheDocument()
  })

  it('shows the type scale without a font when the system has no font family token', () => {
    const noFamily = JSON.stringify({ type: { body: { $value: '14px' } } })
    renderView({ state: { tab: 'tokens' }, content: contentWith(noFamily, COMPONENTS) })
    expect(screen.getByText('Type scale')).toBeInTheDocument()
    expect(screen.queryByText('Color')).toBeNull()
  })
})

describe('PrototypeDesignSystemView Components tab', () => {
  afterEach(cleanup)

  it('counts the components and renders each in a script-less sandboxed frame', () => {
    renderView({ state: { tab: 'components' } })
    expect(
      screen.getByText(
        '2 components · rendered from design/system/components.html with the current tokens'
      )
    ).toBeInTheDocument()
    const frame = screen.getByTitle('Button')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(screen.getByRole('button', { name: 'Select Button' })).toBeInTheDocument()
  })

  it('opens the add panel from "+ Add component"', async () => {
    const user = userEvent.setup()
    const { update } = renderView({ state: { tab: 'components' } })
    await user.click(screen.getByRole('button', { name: '+ Add component' }))
    expect(stateAfter(update, emptyDesignSystemViewState()).addOpen).toBe(true)
  })

  it('shows the add panel’s kinds, its custom field and its two actions when open', () => {
    renderView({ state: { tab: 'components', addOpen: true } })
    for (const kind of ['Badge', 'Modal', 'Table', 'Toast', 'Avatar', 'Toggle']) {
      expect(screen.getByRole('button', { name: kind })).toBeInTheDocument()
    }
    expect(
      screen.getByPlaceholderText('e.g. phase stepper with 3 steps and a status per step')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to draft' })).toBeInTheDocument()
  })

  it('marks a component the draft removes and offers its Undo', () => {
    const removed = { ...emptyDesignSystemViewState().draft, removed: { Button: true as const } }
    renderView({ state: { tab: 'components', draft: removed } })
    expect(screen.getByText('Marked for removal · in the draft')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('shows a component the draft adds as a card to be added by the agent', () => {
    const added = { ...emptyDesignSystemViewState().draft, added: ['Phase stepper'] }
    renderView({ state: { tab: 'components', draft: added } })
    expect(screen.getByText('Phase stepper')).toBeInTheDocument()
    expect(screen.getByText('To be added by the agent · in the draft')).toBeInTheDocument()
  })
})

describe('PrototypeDesignSystemView Source tab', () => {
  afterEach(cleanup)

  it('lists the files the system was detected from, and its version line with the version before', () => {
    renderView({ state: { tab: 'source' } })
    expect(screen.getByText('Detected from')).toBeInTheDocument()
    expect(screen.getByText('src/assets/main.css')).toBeInTheDocument()
    expect(screen.getByText('v2 · Codex · 29 Oct · v1 was detected 21 Oct')).toBeInTheDocument()
  })

  it('sends the re-detect message through the chat, as the Re-detect control', async () => {
    const user = userEvent.setup()
    const { runSend } = renderView({ state: { tab: 'source' } })
    await user.click(screen.getByRole('button', { name: 'Re-detect from project' }))
    expect(runSend).toHaveBeenCalledWith(
      'redetect',
      expect.stringContaining('Re-detect the design system from the project.')
    )
  })

  it('disables Re-detect when no chat of the project can take the message', () => {
    renderView({ state: { tab: 'source' }, target: undefined })
    expect(screen.getByRole('button', { name: 'Re-detect from project' })).toBeDisabled()
  })

  it('shows the send failure under Re-detect when the chat refused it', () => {
    renderView({ state: { tab: 'source', failed: 'redetect' } })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText(/Your draft is kept/u)).toBeInTheDocument()
  })
})
