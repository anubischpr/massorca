// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { DiscoveredSkill, SkillDiscoveryResult } from '../../../../shared/skills'
import { ConfirmationDialogProvider } from '@/components/confirmation-dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { clearRuntimeCompatibilityCacheForTests } from '@/runtime/runtime-rpc-client'
import { useAppStore } from '@/store'
import { MarketplaceSkillsSection } from './MarketplaceSkillsSection'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null

function skill(name: string): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    rootPath: '/home/dev/.agents/skills',
    directoryPath: `/home/dev/.agents/skills/${name}`,
    skillFilePath: `/home/dev/.agents/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null
  }
}

function discoveryResult(names: string[]): SkillDiscoveryResult {
  return { skills: names.map((name) => skill(name)), sources: [], scannedAt: 1 }
}

function setLocalRuntime(): void {
  useAppStore.setState({
    settings: { ...getDefaultSettings('/tmp'), activeRuntimeEnvironmentId: null },
    runtimeEnvironments: [],
    runtimeEnvironmentCatalogSettled: true
  })
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let tick = 0; tick < 8; tick += 1) {
      await Promise.resolve()
    }
  })
}

function renderedSkillNames(): string[] {
  return [...(container?.querySelectorAll('[data-skill-name]') ?? [])].map(
    (node) => node.textContent ?? ''
  )
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...(container?.querySelectorAll('button') ?? [])].find(
    (candidate) =>
      candidate.textContent?.trim() === name || candidate.getAttribute('aria-label') === name
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${name}`)
  }
  return button
}

async function renderSection(onClose: () => void): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <ConfirmationDialogProvider>
          <MarketplaceSkillsSection onClose={onClose} />
        </ConfirmationDialogProvider>
      </TooltipProvider>
    )
  })
}

beforeEach(() => {
  setLocalRuntime()
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount()
    })
  }
  root = null
  container?.remove()
  container = null
  clearRuntimeCompatibilityCacheForTests()
  useAppStore.setState({
    settings: null,
    runtimeEnvironments: [],
    runtimeEnvironmentCatalogSettled: false
  })
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'api')
})

describe('MarketplaceSkillsSection', () => {
  it('renders the installed skills and the install-from-link flow without a page frame', async () => {
    const discover = vi.fn().mockResolvedValue(discoveryResult(['alpha', 'beta']))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        skills: {
          discover,
          deleteSupported: () => Promise.resolve(true),
          onInstallProgress: () => () => undefined
        },
        runtimeEnvironments: { call: vi.fn() }
      }
    })
    await renderSection(vi.fn())
    await flushMicrotasks()

    expect(renderedSkillNames()).toEqual(['alpha', 'beta'])
    expect(container?.querySelector('main')).toBeNull()

    await act(async () => {
      buttonNamed('Install from link').click()
    })

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('leaves the section through its close control', async () => {
    const onClose = vi.fn()
    const discover = vi.fn().mockResolvedValue(discoveryResult(['alpha']))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        skills: {
          discover,
          deleteSupported: () => Promise.resolve(true),
          onInstallProgress: () => () => undefined
        },
        runtimeEnvironments: { call: vi.fn() }
      }
    })
    await renderSection(onClose)
    await flushMicrotasks()

    await act(async () => {
      buttonNamed('Close skills').click()
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
