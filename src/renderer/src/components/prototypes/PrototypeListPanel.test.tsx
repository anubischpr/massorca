// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPrototypeListGroups } from '../../../../shared/prototype-list-groups'
import { buildPrototypeListRows } from '../../../../shared/prototype-list-model'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeListPanel } from './PrototypeListPanel'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

const CREATED = '2026-10-28T20:15:00.000Z'

function set(
  requestId: string,
  project: { key: string; name: string } | null,
  builtOn?: number
): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'codex',
    worktreeId: null,
    chatTitle: null,
    originalPrompt: 'a checkout page',
    createdAt: CREATED,
    count: 1,
    directions: [
      {
        letter: 'A',
        versions: [{ version: 1, fileName: `prototypes/${requestId}/A.html`, mtime: 1 }]
      }
    ],
    ...(project === null ? {} : { projectKey: project.key, projectName: project.name }),
    ...(builtOn === undefined ? {} : { builtOn })
  }
}

const NEXUS = { key: 'nexus', name: 'nexuscare' }
const LANDING = { key: 'landing', name: 'landing-site' }

function system(
  projectKey: string,
  projectName: string,
  status: 'detected' | 'proposed'
): PrototypeListedDesignSystem {
  return {
    projectKey,
    projectName,
    status,
    version: 2,
    tokenCount: 24,
    swatches: ['#2563eb', '#e5e5e5', '#f5f5f5', '#16a34a']
  }
}

function renderList(options: {
  sets: PrototypeListedSet[]
  designSystems?: PrototypeListedDesignSystem[]
  selectedProjectKey?: string | null
  selectedRequestId?: string | null
  onSelect?: (requestId: string) => void
  onSelectSystem?: (projectKey: string) => void
}): void {
  const rows = buildPrototypeListRows({
    sets: options.sets,
    filter: 'all',
    activeLetterOf: () => undefined,
    nowMs: Date.parse(CREATED)
  })
  const groups = buildPrototypeListGroups({
    sets: options.sets,
    rows,
    designSystems: options.designSystems ?? []
  })
  render(
    <PrototypeListPanel
      groups={groups}
      filter="all"
      onFilter={vi.fn()}
      selectedRequestId={options.selectedRequestId ?? null}
      selectedProjectKey={options.selectedProjectKey ?? null}
      onSelect={options.onSelect ?? vi.fn()}
      onSelectSystem={options.onSelectSystem ?? vi.fn()}
    />
  )
}

describe('PrototypeListPanel groups', () => {
  afterEach(cleanup)

  it('heads each project’s group with its name, the newest project first', () => {
    renderList({
      sets: [set('r2', NEXUS, 2), set('r1', LANDING)]
    })
    const headers = screen
      .getAllByText(/^(nexuscare|landing-site)$/u)
      .map((element) => element.textContent)
    expect(headers).toEqual(['nexuscare', 'landing-site'])
  })

  it('shows sets without a project after the named groups, under no header', () => {
    renderList({ sets: [set('r2', null), set('r1', NEXUS)] })
    const headers = screen.getAllByText(/^nexuscare$/u)
    expect(headers).toHaveLength(1)
    const rows = screen.getAllByRole('button', { name: /1 screen/u })
    expect(rows.map((row) => row.closest('div')?.textContent?.includes('nexuscare'))).toEqual([
      true,
      false
    ])
  })

  it('pins a detected design system at the top of its group with its swatches and line', () => {
    renderList({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')]
    })
    const row = screen.getByRole('button', { name: /Design system/u })
    expect(row).toHaveTextContent('Detected · v2 · 24 tokens')
    expect(row.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(4)
    expect(row.compareDocumentPosition(screen.getByRole('button', { name: /1 screen/u }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('shows a proposed design system as needing review, with no swatch icon', () => {
    renderList({
      sets: [set('r1', LANDING)],
      designSystems: [system('landing', 'landing-site', 'proposed')]
    })
    const row = screen.getByRole('button', { name: /Design system/u })
    expect(row).toHaveTextContent('Proposed · needs review')
    expect(row.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('adds the version a set was built on to its status', () => {
    renderList({ sets: [set('r1', NEXUS, 2), set('r2', NEXUS)] })
    expect(screen.getByRole('button', { name: /built on v2/u })).toHaveTextContent(
      '1 screen · built on v2'
    )
    expect(screen.getAllByRole('button', { name: /1 screen/u })).toHaveLength(2)
  })

  it('reports the design system row and each set through their callbacks', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onSelectSystem = vi.fn()
    renderList({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')],
      onSelect,
      onSelectSystem
    })
    await user.click(screen.getByRole('button', { name: /Design system/u }))
    await user.click(screen.getByRole('button', { name: /1 screen/u }))
    expect(onSelectSystem).toHaveBeenCalledWith('nexus')
    expect(onSelect).toHaveBeenCalledWith('r1')
  })

  it('marks the selected design system and no set while a design system is open', () => {
    renderList({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')],
      selectedProjectKey: 'nexus'
    })
    expect(screen.getByRole('button', { name: /Design system/u })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(screen.getByRole('button', { name: /1 screen/u })).not.toHaveAttribute('aria-current')
  })
})
