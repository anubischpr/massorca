// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import type { CatalogRow } from './MarketplaceCatalogRows'
import { toolStatus } from './MarketplaceBoardToolPage'

vi.mock('@/i18n/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_all, name: string) => String(values?.[name] ?? ''))
}))

function toolRow(id: 'gh' | 'node', status: CatalogRow['status']): CatalogRow {
  return {
    key: `board-${id}`,
    section: 'tools',
    name: id === 'gh' ? 'GitHub CLI' : 'Node.js',
    description: '',
    icon: { kind: 'skill' },
    status,
    target: { kind: 'board-tool', id },
    owned: false,
    service: false,
    customId: null
  }
}

describe('the board tool header line', () => {
  it('says GitHub CLI is not installed on the host, as a warning, when its row says Not installed', () => {
    const row = toolRow('gh', { kind: 'pending', label: 'Not installed' })
    expect(toolStatus(row, true, 'pv-vps')).toEqual({
      label: 'Not installed on pv-vps',
      tone: 'warn'
    })
  })

  it('says Node.js has no install check yet, whatever its row label', () => {
    const row = toolRow('node', { kind: 'pending', label: 'Not checked' })
    expect(toolStatus(row, false, 'pv-vps')).toEqual({
      label: 'No install check for Node.js yet',
      tone: 'pending'
    })
  })
})
