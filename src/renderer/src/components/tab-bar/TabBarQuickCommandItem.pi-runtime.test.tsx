// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from '@/components/ui/command'
import type { HostedTerminalQuickCommand } from '@/hooks/use-terminal-quick-command-hosts'
import type { TerminalAgentQuickCommand } from '../../../../shared/terminal-quick-command-types'
import { TabBarQuickCommandItem } from './TabBarQuickCommandItem'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const runtime = vi.hoisted<{ current: 'gentle-shell' | 'pi' | 'unknown' }>(() => ({
  current: 'gentle-shell'
}))

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/lib/use-pi-runtime', () => ({
  usePiDisplayRuntime: () => runtime.current
}))

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentDisplayLabel: (_agent: string, piRuntime: string) =>
    piRuntime === 'gentle-shell' ? 'Gentle Shell' : piRuntime === 'pi' ? 'Pi' : 'Pi / Gentle Shell'
}))

const agentCommand: TerminalAgentQuickCommand = {
  id: 'agent-1',
  label: 'Review',
  action: 'agent-prompt',
  agent: 'pi',
  prompt: 'review the diff',
  scope: { type: 'repo', repoId: 'repo-1' }
}

const agentEntry: HostedTerminalQuickCommand = {
  key: 'local:agent-1',
  hostId: 'local',
  hostLabel: 'This Mac',
  command: agentCommand
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderAgentItem(): void {
  act(() => {
    root.render(
      createElement(
        Command,
        { shouldFilter: false },
        createElement(TabBarQuickCommandItem, {
          entry: agentEntry,
          showHostLabel: false,
          onRun: vi.fn(),
          onEdit: vi.fn(),
          onDelete: vi.fn()
        })
      )
    )
  })
}

describe('TabBarQuickCommandItem Pi runtime row', () => {
  it('names Gentle Shell and carries the brand row attribute when the Pi runtime is Gentle Shell', () => {
    runtime.current = 'gentle-shell'
    renderAgentItem()
    const row = container.querySelector('[data-agent-brand="gentle-shell"]')
    expect(row).not.toBeNull()
    expect(container.textContent).toContain('Gentle Shell: review the diff')
    expect(container.textContent).not.toContain('Pi / Gentle Shell')
  })

  it('names stock Pi without the brand row attribute when the runtime is stock Pi', () => {
    runtime.current = 'pi'
    renderAgentItem()
    expect(container.querySelector('[data-agent-brand]')).toBeNull()
    expect(container.textContent).toContain('Pi: review the diff')
  })

  it('keeps the neutral label while the runtime is unknown', () => {
    runtime.current = 'unknown'
    renderAgentItem()
    expect(container.querySelector('[data-agent-brand]')).toBeNull()
    expect(container.textContent).toContain('Pi / Gentle Shell: review the diff')
  })
})
