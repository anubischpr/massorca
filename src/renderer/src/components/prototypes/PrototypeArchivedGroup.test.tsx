// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPrototypeListGroups } from '../../../../shared/prototype-list-groups'
import { buildPrototypeListRows } from '../../../../shared/prototype-list-model'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import type { PrototypeArchiveControls } from './PrototypeArchivedGroup'
import { PrototypeListPanel } from './PrototypeListPanel'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

const CREATED = '2026-10-28T20:15:00.000Z'

function set(
  requestId: string,
  chatTitle: string,
  extra: Partial<PrototypeListedSet> = {}
): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'codex',
    worktreeId: null,
    chatTitle,
    originalPrompt: 'a checkout page',
    createdAt: CREATED,
    count: 1,
    directions: [
      {
        letter: 'A',
        versions: [{ version: 1, fileName: `prototypes/${requestId}/A.html`, mtime: 1 }]
      }
    ],
    ...extra
  }
}

function rowsOf(sets: PrototypeListedSet[]) {
  return buildPrototypeListRows({
    sets,
    filter: 'all',
    activeLetterOf: () => undefined,
    nowMs: Date.parse(CREATED)
  })
}

function renderList(options: {
  active: PrototypeListedSet[]
  archived: PrototypeListedSet[]
  supports?: boolean
  onSelect?: (requestId: string) => void
}) {
  const controls = {
    onArchive: vi.fn(),
    onUnarchive: vi.fn(),
    onDelete: vi.fn()
  }
  const archive: PrototypeArchiveControls = {
    rows: rowsOf(options.archived),
    supports: () => options.supports ?? true,
    ...controls
  }
  render(
    <PrototypeListPanel
      groups={buildPrototypeListGroups({
        sets: options.active,
        rows: rowsOf(options.active),
        designSystems: []
      })}
      filter="all"
      onFilter={vi.fn()}
      selectedRequestId={null}
      selectedProjectKey={null}
      onSelect={options.onSelect ?? vi.fn()}
      onSelectSystem={vi.fn()}
      archive={archive}
    />
  )
  return controls
}

describe('the Archived group of the prototype list', () => {
  afterEach(cleanup)

  it('shows no group while nothing is archived', () => {
    renderList({ active: [set('r1', 'Checkout')], archived: [] })
    expect(screen.queryByRole('button', { name: /Archived/u })).toBeNull()
  })

  it('comes last, collapsed with its count, and keeps archived sets out of the main list', async () => {
    const user = userEvent.setup()
    renderList({
      active: [set('r1', 'Checkout')],
      archived: [set('r2', 'Old pricing', { archived: true })]
    })
    const heading = screen.getByRole('button', { name: /Archived/u })
    expect(heading).toHaveTextContent('Archived1')
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Old pricing')).toBeNull()
    expect(screen.getByText('Checkout').compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    await user.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Old pricing')).toBeInTheDocument()
  })

  it('opens an archived set like any row, and unarchives it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const controls = renderList({
      active: [],
      archived: [set('r2', 'Old pricing', { archived: true })],
      onSelect
    })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    await user.click(screen.getByRole('button', { name: /Old pricing/u }))
    expect(onSelect).toHaveBeenCalledWith('r2')

    await user.click(screen.getByRole('button', { name: 'Unarchive' }))
    expect(controls.onUnarchive).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r2' }))
  })

  it('offers Delete only for a set the host lists as deletable, and asks before deleting', async () => {
    const user = userEvent.setup()
    const controls = renderList({
      active: [],
      archived: [
        set('r2', 'Gone chat', { archived: true, deletable: true }),
        set('r3', 'Live chat', { archived: true })
      ]
    })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    const deletes = screen.getAllByRole('button', { name: 'Delete' })
    expect(deletes).toHaveLength(1)

    await user.click(deletes[0])
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Delete this prototype set?')
    expect(dialog).toHaveTextContent('Gone chat')
    expect(controls.onDelete).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(controls.onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(controls.onDelete).toHaveBeenCalledTimes(1)
    expect(controls.onDelete).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r2' }))
  })

  it('archives a set from its row menu', async () => {
    const user = userEvent.setup()
    const controls = renderList({ active: [set('r1', 'Checkout')], archived: [] })
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect(controls.onArchive).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'r1' }))
  })

  it('offers no actions for a set whose host predates archiving', async () => {
    const user = userEvent.setup()
    renderList({
      active: [set('r1', 'Checkout')],
      archived: [set('r2', 'Old pricing', { archived: true, deletable: true })],
      supports: false
    })
    expect(screen.queryByRole('button', { name: 'Actions for Checkout' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
  })
})
