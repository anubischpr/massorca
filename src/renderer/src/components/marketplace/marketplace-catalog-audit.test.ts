// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import {
  auditMarketplaceCatalog,
  resolveAuditHost,
  type CatalogAuditDeps
} from './marketplace-catalog-audit'
import type { CatalogHostReads } from './MarketplaceCatalogData'
import { MARKETPLACE_PAGE_STRUCTURE } from './marketplace-page-structure'
import type { MarketplaceVaultHostTarget } from './marketplace-vault-host-client'
import { answerMarketplaceAuditRequest } from '../../marketplace-audit-bridge'
import type {
  MarketplaceCatalogAuditRendererResult,
  MarketplaceCatalogAuditResponse
} from '../../../../shared/rpc-contract/marketplace-catalog-audit-params'

const PV_VPS: MarketplaceVaultHostTarget = {
  kind: 'runtime',
  environmentId: 'env-1',
  label: 'pv-vps'
}

function remoteReads(hostLabel: string): CatalogHostReads {
  return {
    local: false,
    hostLabel,
    apps: { status: 'unavailable' },
    preflight: { preflight: null, checked: false },
    marketplaceAgents: null,
    skills: { status: 'loading' },
    custom: { items: null, installingIds: new Set() },
    remote: {
      tools: {
        kind: 'ready',
        value: { git: true, gh: { installed: true, authenticated: true }, glab: undefined }
      },
      agents: { kind: 'ready', value: new Set<string>() },
      piRuntimes: { kind: 'ready', value: [] },
      skills: { kind: 'ready', value: [] },
      apps: { kind: 'ready', value: [] }
    },
    integrations: {
      gitlab: 'not-connected',
      bitbucket: 'not-connected',
      'azure-devops': 'not-connected',
      gitea: 'not-connected',
      linear: 'not-connected',
      jira: 'not-connected'
    }
  }
}

function auditDeps(
  hostReads: CatalogAuditDeps['hostReads'] = vi.fn(async () => ({
    reads: remoteReads('pv-vps'),
    skillTarget: null
  }))
): CatalogAuditDeps {
  return {
    thisComputer: 'This computer',
    targets: async () => [PV_VPS],
    hostReads,
    scan: () => Promise.resolve({ skills: [], sources: [], scannedAt: 1 })
  }
}

describe('answerMarketplaceAuditRequest', () => {
  it('answers the request id with the audit result through a fake sender', async () => {
    const sent: MarketplaceCatalogAuditResponse[] = []
    const audit = vi.fn<(host: string) => Promise<MarketplaceCatalogAuditRendererResult>>(
      async () => ({
        ok: false,
        reason: 'invalid-host',
        message: 'No paired host env-9 on this computer'
      })
    )
    await answerMarketplaceAuditRequest(
      { id: 'req-1', host: 'runtime:env-9' },
      audit,
      (response) => {
        sent.push(response)
      }
    )
    expect(audit).toHaveBeenCalledWith('runtime:env-9')
    expect(sent).toEqual([
      {
        id: 'req-1',
        ok: true,
        result: {
          ok: false,
          reason: 'invalid-host',
          message: 'No paired host env-9 on this computer'
        }
      }
    ])
  })
})

describe('resolveAuditHost', () => {
  it('names a paired runtime host the picker lists', () => {
    expect(resolveAuditHost('runtime:env-1', [PV_VPS])).toEqual({ ok: true, pickedTarget: PV_VPS })
  })

  it('answers invalid-host for a runtime id the picker does not list, never local', () => {
    expect(resolveAuditHost('runtime:env-9', [PV_VPS])).toEqual({
      ok: false,
      message: 'No paired host env-9 on this computer'
    })
  })

  it('reads this computer for the local key', () => {
    expect(resolveAuditHost('local', [PV_VPS])).toEqual({ ok: true, pickedTarget: null })
  })
})

describe('auditMarketplaceCatalog', () => {
  it('audits the runtime host it names and reports that host', async () => {
    const hostReads = vi.fn(async () => ({ reads: remoteReads('pv-vps'), skillTarget: null }))
    const result = await auditMarketplaceCatalog('runtime:env-1', auditDeps(hostReads))
    expect(hostReads).toHaveBeenCalledWith(PV_VPS, 'pv-vps')
    expect(result).toMatchObject({ ok: true, host: { key: 'runtime:env-1', label: 'pv-vps' } })
  })

  it('answers invalid-host for an unknown runtime id and reads no host', async () => {
    const hostReads = vi.fn(async () => ({ reads: remoteReads('pv-vps'), skillTarget: null }))
    expect(await auditMarketplaceCatalog('runtime:env-9', auditDeps(hostReads))).toEqual({
      ok: false,
      reason: 'invalid-host',
      message: 'No paired host env-9 on this computer'
    })
    expect(hostReads).not.toHaveBeenCalled()
  })

  it('reports the Git row as an item detail page with its descriptor structure', async () => {
    const result = await auditMarketplaceCatalog('runtime:env-1', auditDeps())
    expect(result).toMatchObject({
      ok: true,
      rows: expect.arrayContaining([
        expect.objectContaining({
          key: 'item-git',
          page: { opens: true, pageKind: 'item-detail' },
          structure: MARKETPLACE_PAGE_STRUCTURE['item-detail'],
          source: 'external',
          externalDependencies: ['Git on the host PATH']
        })
      ])
    })
  })

  it('reports the board tool rows as opening their own page, with its structure', async () => {
    const result = await auditMarketplaceCatalog('runtime:env-1', auditDeps())
    expect(result).toMatchObject({
      ok: true,
      rows: expect.arrayContaining([
        expect.objectContaining({
          key: 'board-node',
          page: { opens: true, pageKind: 'board-tool' },
          structure: MARKETPLACE_PAGE_STRUCTURE['board-tool']
        })
      ])
    })
  })
})
