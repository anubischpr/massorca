// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INSTALLED_AGENT_SKILLS_CHANGED_EVENT } from '@/hooks/installed-agent-skills-change-event'
import type { RuntimeClientTarget } from '@/runtime/runtime-client-target'
import type { ManagedSkillInstall } from '../../../../shared/skill-install-contract'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { buildCatalogSections, type CatalogBuildInputs } from './MarketplaceCatalogRows'
import {
  resetMarketplaceInstalledSkillsForTests,
  useMarketplaceInstalledSkills,
  type MarketplaceInstalledSkills
} from './MarketplaceCatalogSkills'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  listInstalls: vi.fn()
}))
let mockTarget: RuntimeClientTarget = { kind: 'local' }

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))
vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null,
  getAgentLabel: (agent: string) => agent,
  getAgentDisplayLabel: (agent: string) => agent
}))
vi.mock('@/lib/pi-agent-display', () => ({ piRuntimeLabel: () => 'Gentle Shell' }))
vi.mock('@/hooks/use-active-skill-discovery-runtime-target', () => ({
  useActiveSkillDiscoveryRuntimeTarget: () => mockTarget
}))
vi.mock('@/runtime/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: (...args: unknown[]) => mocks.discover(...args)
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLDivElement | null = null
let latest: MarketplaceInstalledSkills = { status: 'loading' }

function Probe(): null {
  latest = useMarketplaceInstalledSkills()
  return null
}

function skill(name: string, overrides: Partial<DiscoveredSkill> = {}): DiscoveredSkill {
  return {
    id: `skill-${name}`,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Claude skills home',
    rootPath: '/home/dev/.claude/skills',
    directoryPath: `/home/dev/.claude/skills/${name}`,
    skillFilePath: `/home/dev/.claude/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: null,
    ...overrides
  }
}

function install(name: string, overrides: Partial<ManagedSkillInstall> = {}): ManagedSkillInstall {
  return {
    name,
    packageId: `pkg-${name}`,
    versionId: 'v1',
    packageDigest: 'a'.repeat(64),
    scope: 'global',
    destinationIdentity: 'global:local',
    destination: { scope: 'global' },
    installedAt: '2026-11-01T00:00:00.000Z',
    state: 'unchanged',
    ...overrides
  }
}

function scanned(skills: DiscoveredSkill[]) {
  return { skills, sources: [], scannedAt: 1 }
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(createElement(Probe))
  })
  await settle()
}

function readySkills(): readonly DiscoveredSkill[] {
  if (latest.status !== 'ready') {
    throw new Error(`Expected the scan to be ready, was ${latest.status}`)
  }
  return latest.skills
}

/** The names the Skills section lists for these skills, board rows and commands included. */
function listedSkillNames(skills: readonly DiscoveredSkill[]): string[] {
  const inputs: CatalogBuildInputs = {
    hostLabel: 'This computer',
    badgeFor: () => 'not-installed',
    cli: { gh: 'not-installed' },
    integrations: {
      gitlab: 'not-connected',
      bitbucket: 'not-connected',
      'azure-devops': 'not-connected',
      gitea: 'not-connected',
      linear: 'not-connected',
      jira: 'not-connected'
    },
    agents: [],
    skills: { kind: 'ready', value: skills },
    custom: { kind: 'ready', items: [] },
    installingCustomIds: new Set()
  }
  const section = buildCatalogSections(inputs).find((candidate) => candidate.id === 'skills')
  return (section?.rows ?? []).map((row) => row.name)
}

beforeEach(() => {
  mockTarget = { kind: 'local' }
  mocks.discover.mockReset()
  mocks.listInstalls.mockReset()
  mocks.discover.mockResolvedValue(scanned([]))
  mocks.listInstalls.mockResolvedValue({ status: 'ok', value: [] })
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: { skills: { listManagedInstalls: mocks.listInstalls } }
  })
  resetMarketplaceInstalledSkillsForTests()
  latest = { status: 'loading' }
})

afterEach(async () => {
  if (root) {
    const mounted = root
    await act(async () => {
      mounted.unmount()
    })
  }
  root = null
  container?.remove()
  container = null
  resetMarketplaceInstalledSkillsForTests()
  Reflect.deleteProperty(window, 'api')
})

describe('the installed skills the Marketplace lists', () => {
  it('marks a skill MassOrca installed from the Marketplace, and the Skills section lists it', async () => {
    mocks.discover.mockResolvedValue(scanned([skill('calendar'), skill('sdd-init')]))
    mocks.listInstalls.mockResolvedValue({ status: 'ok', value: [install('calendar')] })
    await mount()

    const skills = readySkills()
    expect(skills.find((entry) => entry.name === 'calendar')?.source).toBe('marketplace')
    expect(skills.find((entry) => entry.name === 'sdd-init')?.source).toBeUndefined()
    expect(listedSkillNames(skills)).toContain('Calendar')
    expect(listedSkillNames(skills)).not.toContain('Sdd init')
  })

  it('keeps a skill that no managed install names hidden', async () => {
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    mocks.listInstalls.mockResolvedValue({ status: 'ok', value: [install('other-skill')] })
    await mount()

    const skills = readySkills()
    expect(skills[0]?.source).toBeUndefined()
    expect(listedSkillNames(skills)).not.toContain('Calendar')
  })

  it('reads the managed installs for the same environment the scan reads', async () => {
    mockTarget = { kind: 'environment', environmentId: 'env-7' }
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    mocks.listInstalls.mockResolvedValue({ status: 'ok', value: [install('calendar')] })
    await mount()

    expect(mocks.discover).toHaveBeenCalledWith({ kind: 'environment', environmentId: 'env-7' })
    expect(mocks.listInstalls).toHaveBeenCalledWith('env-7')
    expect(readySkills()[0]?.source).toBe('marketplace')
  })

  it('keeps the skills hidden, without an error, when the managed listing fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    mocks.listInstalls.mockRejectedValue(new Error('listing offline'))
    await mount()

    expect(latest.status).toBe('ready')
    expect(readySkills()[0]?.source).toBeUndefined()
    expect(listedSkillNames(readySkills())).not.toContain('Calendar')
    warn.mockRestore()
  })

  it('keeps the skills hidden when the host answers the listing as unsupported', async () => {
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    mocks.listInstalls.mockResolvedValue({
      status: 'unsupported',
      message: 'Update MassOrca on this host'
    })
    await mount()

    expect(readySkills()[0]?.source).toBeUndefined()
    expect(listedSkillNames(readySkills())).not.toContain('Calendar')
  })

  it('keeps the skills hidden, without a crash, when this client has no managed-install bridge', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    Reflect.deleteProperty(window, 'api')
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    await mount()

    expect(latest.status).toBe('ready')
    expect(readySkills()[0]?.source).toBeUndefined()
    warn.mockRestore()
  })

  it('rescans the managed installs when the installed skills change', async () => {
    mocks.discover.mockResolvedValue(scanned([skill('calendar')]))
    await mount()
    expect(readySkills()[0]?.source).toBeUndefined()

    mocks.listInstalls.mockResolvedValue({ status: 'ok', value: [install('calendar')] })
    await act(async () => {
      window.dispatchEvent(new Event(INSTALLED_AGENT_SKILLS_CHANGED_EVENT))
    })
    await settle()

    expect(readySkills()[0]?.source).toBe('marketplace')
  })
})
