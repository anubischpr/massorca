// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiscoveredSkill } from '../../../../shared/skills'
import { useMarketplaceCatalog } from './MarketplaceCatalogData'
import type { CatalogRow, CatalogSection } from './MarketplaceCatalogRows'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import {
  readRemoteHostChecks,
  useMarketplaceRemoteDetection
} from './use-marketplace-remote-detection'

const mocks = vi.hoisted(() => ({
  callRuntimeRpc: vi.fn(),
  discoverSkills: vi.fn(),
  readHostApps: vi.fn(),
  detectRemoteAgents: vi.fn()
}))

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
vi.mock('@/runtime/runtime-rpc-client', () => ({
  callRuntimeRpc: (...args: unknown[]) => mocks.callRuntimeRpc(...args)
}))
vi.mock('@/runtime/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: (...args: unknown[]) => mocks.discoverSkills(...args)
}))
vi.mock('./marketplace-apps-host-client', () => ({
  readHostApps: (...args: unknown[]) => mocks.readHostApps(...args)
}))
vi.mock('./use-marketplace-preflight', () => ({
  useMarketplacePreflight: () => ({ preflight: null, checked: false })
}))
vi.mock('./use-marketplace-agents', () => ({ useMarketplaceAgents: () => null }))
vi.mock('./MarketplaceCatalogSkills', () => ({
  useMarketplaceInstalledSkills: () => ({ status: 'loading' })
}))
vi.mock('./MarketplaceCatalogCustom', () => ({
  useMarketplaceCustomItems: () => ({ items: null, installingIds: new Set(), install: vi.fn() })
}))

const PV_VPS: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-vps',
  label: 'pv-vps'
}
const OTHER_VPS: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-other',
  label: 'other'
}
const SSH_BOX: MarketplaceVaultHostTarget = { kind: 'ssh', connectionId: 'conn-1', label: 'box' }
const ENVIRONMENT_VPS = { kind: 'environment', environmentId: 'env-vps' }

function methodNotFound(): Error {
  return Object.assign(new Error('Method not found'), { code: 'method_not_found' })
}

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

function answerRpc(answers: Record<string, unknown>): void {
  mocks.callRuntimeRpc.mockImplementation((_target: unknown, method: string) => {
    const answer = answers[method]
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  })
}

function sectionNamed(sections: readonly CatalogSection[], name: string): CatalogSection {
  const section = sections.find((candidate) => candidate.name === name)
  if (!section) {
    throw new Error(`No section ${name}`)
  }
  return section
}

function rowNamed(sections: readonly CatalogSection[], name: string): CatalogRow {
  const found = sections.flatMap((section) => section.rows).find((item) => item.name === name)
  if (!found) {
    throw new Error(`No row ${name}`)
  }
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  answerRpc({
    'preflight.check': { git: { installed: true }, gh: { installed: true, authenticated: false } },
    'preflight.detectAgents': ['codex'],
    'preflight.detectPiRuntimes': ['gentle-shell']
  })
  mocks.discoverSkills.mockResolvedValue({ skills: [skill('alpha')], sources: [], scannedAt: 1 })
  mocks.readHostApps.mockResolvedValue({ ok: true, apps: [] })
  mocks.detectRemoteAgents.mockResolvedValue(['codex'])
  Object.defineProperty(window, 'api', {
    value: { preflight: { detectRemoteAgents: mocks.detectRemoteAgents } },
    configurable: true,
    writable: true
  })
})

describe('reading a picked runtime host', () => {
  it('reads it through the calls the phone uses, against that host alone', async () => {
    const reads = await readRemoteHostChecks(PV_VPS)
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      ENVIRONMENT_VPS,
      'preflight.check',
      {},
      expect.any(Object)
    )
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      ENVIRONMENT_VPS,
      'preflight.detectAgents',
      undefined,
      expect.any(Object)
    )
    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      ENVIRONMENT_VPS,
      'preflight.detectPiRuntimes',
      undefined,
      expect.any(Object)
    )
    expect(mocks.discoverSkills).toHaveBeenCalledWith(ENVIRONMENT_VPS)
    expect(mocks.readHostApps).toHaveBeenCalledWith(PV_VPS)
    expect(reads.tools).toEqual({
      kind: 'ready',
      value: { git: true, gh: { installed: true, authenticated: false }, glab: undefined }
    })
    expect(reads.agents).toEqual({ kind: 'ready', value: new Set(['codex']) })
    expect(reads.piRuntimes).toEqual({ kind: 'ready', value: ['gentle-shell'] })
    expect(reads.skills).toEqual({ kind: 'ready', value: [skill('alpha')] })
    expect(reads.apps).toEqual({ kind: 'ready', value: [] })
  })

  it('reads a call the host predates as update-required, and any other failure as failed', async () => {
    answerRpc({
      'preflight.check': { git: { installed: true }, gh: { installed: true, authenticated: true } },
      'preflight.detectAgents': new Error('timed out'),
      'preflight.detectPiRuntimes': methodNotFound()
    })
    const reads = await readRemoteHostChecks(PV_VPS)
    expect(reads.agents).toEqual({ kind: 'failed' })
    expect(reads.piRuntimes).toEqual({ kind: 'update-required' })
    expect(reads.tools.kind).toBe('ready')
  })

  it('reads skills a host without skill discovery predates as update-required', async () => {
    mocks.discoverSkills.mockRejectedValue(methodNotFound())
    expect((await readRemoteHostChecks(PV_VPS)).skills).toEqual({ kind: 'update-required' })
  })

  it('reads an apps list the host says needs an update as update-required, and an unreachable one as failed', async () => {
    mocks.readHostApps.mockResolvedValue({ ok: false, reason: 'host-needs-update' })
    expect((await readRemoteHostChecks(PV_VPS)).apps).toEqual({ kind: 'update-required' })
    mocks.readHostApps.mockResolvedValue({ ok: false, reason: 'unreachable' })
    expect((await readRemoteHostChecks(PV_VPS)).apps).toEqual({ kind: 'failed' })
  })
})

describe('reading a picked SSH host', () => {
  it('reads its agents through its own probe, and reports what has no path as failed', async () => {
    const reads = await readRemoteHostChecks(SSH_BOX)
    expect(mocks.detectRemoteAgents).toHaveBeenCalledWith({ connectionId: 'conn-1' })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
    expect(mocks.discoverSkills).not.toHaveBeenCalled()
    expect(reads.agents).toEqual({ kind: 'ready', value: new Set(['codex']) })
    expect(reads.tools).toEqual({ kind: 'failed' })
    expect(reads.piRuntimes).toEqual({ kind: 'failed' })
    expect(reads.skills).toEqual({ kind: 'failed' })
    expect(mocks.readHostApps).toHaveBeenCalledWith(SSH_BOX)
  })
})

describe('the picked host reads in the hook', () => {
  it('stays loading until the picked host answers, and never shows an earlier host answer', async () => {
    mocks.readHostApps.mockImplementation((target: MarketplaceVaultHostTarget) =>
      target.label === 'other'
        ? new Promise(() => undefined)
        : Promise.resolve({ ok: true, apps: [] })
    )
    mocks.callRuntimeRpc.mockImplementation((target: { environmentId: string }, method: string) =>
      target.environmentId === 'env-other'
        ? new Promise(() => undefined)
        : Promise.resolve(
            method === 'preflight.detectAgents'
              ? ['codex']
              : { git: { installed: true }, gh: { installed: true, authenticated: false } }
          )
    )
    const initialTarget: MarketplaceVaultHostTarget | null = PV_VPS
    const { result, rerender } = renderHook(
      ({ target }: { target: MarketplaceVaultHostTarget | null }) =>
        useMarketplaceRemoteDetection(target),
      { initialProps: { target: initialTarget } }
    )
    expect(result.current.tools).toEqual({ kind: 'loading' })
    await waitFor(() => expect(result.current.tools.kind).toBe('ready'))
    rerender({ target: OTHER_VPS })
    expect(result.current.tools).toEqual({ kind: 'loading' })
    expect(result.current.agents).toEqual({ kind: 'loading' })
  })

  it('reads a target the catalog has no host for as failed, and calls no host', () => {
    const { result } = renderHook(() => useMarketplaceRemoteDetection(null))
    expect(result.current.tools).toEqual({ kind: 'failed' })
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })
})

describe('the catalog on a picked remote host', () => {
  it('lists the board agents with Found from that host, and only the board skills from its plain skills', async () => {
    const { result } = renderHook(() =>
      useMarketplaceCatalog({
        hostLabel: 'pv-vps',
        local: false,
        remoteTarget: PV_VPS,
        apps: { status: 'loading' },
        refreshPreflight: false
      })
    )
    await waitFor(() =>
      expect(rowNamed(result.current.sections, 'Codex').status).toEqual({
        kind: 'found',
        label: 'Found'
      })
    )
    const agents = sectionNamed(result.current.sections, 'Agents').rows
    expect(agents.map((row) => [row.name, row.status])).toEqual([
      ['Claude Code', { kind: 'action', label: 'Install' }],
      ['Codex', { kind: 'found', label: 'Found' }],
      ['Antigravity', { kind: 'action', label: 'Install' }],
      ['Gentle Shell', { kind: 'found', label: 'Found' }]
    ])
    // Why: a plain skill on the host is not a Marketplace install, so only the board skills list.
    await waitFor(() =>
      expect(rowNamed(result.current.sections, 'Browser use').status).toEqual({
        kind: 'action',
        label: 'Install'
      })
    )
    const skillNames = sectionNamed(result.current.sections, 'Skills').rows.map((row) => row.name)
    expect(skillNames).not.toContain('alpha')
    expect(skillNames.slice(0, 5)).toEqual([
      'Browser use',
      'Computer use',
      'Linear',
      'Orchestration',
      'Price check'
    ])
  })

  it('reads a picked host the catalog was given no target for as could not check, never as this computer', () => {
    const { result } = renderHook(() =>
      useMarketplaceCatalog({
        hostLabel: 'pv-vps',
        local: false,
        apps: { status: 'loading' },
        refreshPreflight: false
      })
    )
    const agents = sectionNamed(result.current.sections, 'Agents').rows
    expect(agents.map((row) => row.status)).toEqual(
      agents.map(() => ({ kind: 'pending', label: 'Could not check' }))
    )
    expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
  })

  describe('reading a WSL distro', () => {
    const UBUNTU: MarketplaceVaultHostTarget = {
      kind: 'wsl',
      distro: 'Ubuntu',
      label: 'WSL: Ubuntu'
    }

    it('reads its tools and agents from the distro, and its apps, Pi runtimes and skills as failed', async () => {
      const detectAgents = vi.fn().mockResolvedValue(['codex'])
      const check = vi.fn().mockResolvedValue({
        git: { installed: true },
        gh: { installed: false, authenticated: false }
      })
      Object.defineProperty(window, 'api', {
        value: { preflight: { detectAgents, check } },
        configurable: true,
        writable: true
      })
      const reads = await readRemoteHostChecks(UBUNTU)
      expect(detectAgents).toHaveBeenCalledWith({ wslDistro: 'Ubuntu' })
      expect(check).toHaveBeenCalledWith({ wslDistro: 'Ubuntu' })
      expect(reads.agents).toEqual({ kind: 'ready', value: new Set(['codex']) })
      expect(reads.tools).toEqual({
        kind: 'ready',
        value: { git: true, gh: { installed: false, authenticated: false } }
      })
      expect(reads.apps).toEqual({ kind: 'failed' })
      expect(reads.piRuntimes).toEqual({ kind: 'failed' })
      expect(reads.skills).toEqual({ kind: 'failed' })
      expect(mocks.callRuntimeRpc).not.toHaveBeenCalled()
      expect(mocks.readHostApps).not.toHaveBeenCalled()
    })

    it('answers tools and agents as could not check when the distro cannot be probed', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('probe failed'))
      Object.defineProperty(window, 'api', {
        value: { preflight: { detectAgents: failing, check: failing } },
        configurable: true,
        writable: true
      })
      const reads = await readRemoteHostChecks(UBUNTU)
      expect(reads.agents).toEqual({ kind: 'failed' })
      expect(reads.tools).toEqual({ kind: 'failed' })
    })
  })
})
