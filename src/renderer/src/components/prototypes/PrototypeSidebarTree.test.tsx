// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type {
  PrototypeListedDesignSystem,
  PrototypeListedSet
} from '../../../../shared/rpc-contract/prototype-params'
import type { PrototypeSetsResult } from './use-prototype-sets'
import { PrototypeSidebarTree } from './PrototypeSidebarTree'

const actions = vi.hoisted(() => ({ run: vi.fn() }))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
}))

vi.mock('./prototype-set-actions', () => ({
  prototypeHostKey: () => 'local',
  runPrototypeSetAction: actions.run
}))

const CREATED = '2026-10-28T20:15:00.000Z'

function set(
  requestId: string,
  project: { key: string; name: string } | null,
  extra: Partial<PrototypeListedSet> = {}
): PrototypeListedSet {
  return {
    requestId,
    sessionId: 'session-alpha-0001',
    agent: 'codex',
    worktreeId: null,
    chatTitle: `Set ${requestId}`,
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
    ...extra
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

type TreeOptions = {
  sets: PrototypeListedSet[]
  designSystems?: PrototypeListedDesignSystem[]
  selectedRequestId?: string | null
  selectedProjectKey?: string | null
  collapsed?: ReadonlySet<string>
  onToggleCollapsed?: (key: string) => void
  onOpenRequest?: (requestId: string) => void
  onOpenSystem?: (projectKey: string) => void
  onSelectRequest?: (requestId: string | null) => void
}

function renderTree(options: TreeOptions): { reload: ReturnType<typeof vi.fn> } {
  const reload = vi.fn()
  const listed: PrototypeSetsResult = {
    status: 'ready',
    sets: options.sets,
    designSystems: options.designSystems ?? [],
    reload
  }
  render(
    <TooltipProvider>
      <PrototypeSidebarTree
        listed={listed}
        selectedRequestId={options.selectedRequestId ?? null}
        selectedProjectKey={options.selectedProjectKey ?? null}
        collapsed={options.collapsed ?? new Set<string>()}
        onToggleCollapsed={options.onToggleCollapsed ?? vi.fn()}
        onOpenRequest={options.onOpenRequest ?? vi.fn()}
        onOpenSystem={options.onOpenSystem ?? vi.fn()}
        onSelectRequest={options.onSelectRequest ?? vi.fn()}
      />
    </TooltipProvider>
  )
  return { reload }
}

describe('PrototypeSidebarTree groups', () => {
  afterEach(() => {
    cleanup()
    actions.run.mockReset()
  })

  it('heads each project with its name, the newest project first', () => {
    renderTree({ sets: [set('r2', NEXUS), set('r1', LANDING)] })
    const headers = screen
      .getAllByRole('button', { name: /^(nexuscare|landing-site)$/u })
      .map((element) => element.textContent)
    expect(headers).toEqual(['nexuscare', 'landing-site'])
  })

  it('shows sets without a project after the named groups, under no header', () => {
    renderTree({
      sets: [set('r2', null, { chatTitle: 'Checkout' }), set('r1', NEXUS, { chatTitle: 'Pricing' })]
    })
    expect(screen.getAllByRole('button', { name: /^nexuscare$/u })).toHaveLength(1)
    const titles = screen
      .getAllByRole('button', { name: /^(Pricing|Checkout)/u })
      .map((row) => row.textContent?.trim().startsWith('Pricing') ?? false)
    expect(titles).toEqual([true, false])
  })

  it('pins a detected design system above its sets, with a Palette icon in the status amber', () => {
    renderTree({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')]
    })
    const row = screen.getByRole('button', { name: /Design system/u })
    const icon = row.querySelector('svg')
    expect(icon).toHaveClass('lucide-palette', 'text-status-amber')
    const setRow = screen.getByRole('button', { name: /^Set r1/u })
    expect(row.compareDocumentPosition(setRow)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows a proposed design system with the same Palette row', () => {
    renderTree({
      sets: [set('r1', LANDING)],
      designSystems: [system('landing', 'landing-site', 'proposed')]
    })
    expect(screen.getByRole('button', { name: /Design system/u }).querySelector('svg')).toHaveClass(
      'lucide-palette'
    )
  })

  it('gives each set row a LayoutTemplate icon in the muted foreground', () => {
    renderTree({ sets: [set('r1', NEXUS)] })
    const icon = screen.getByRole('button', { name: /^Set r1/u }).querySelector('svg')
    expect(icon).toHaveClass('lucide-layout-template', 'text-muted-foreground')
  })

  it('reports the design system row and each set through their callbacks', async () => {
    const user = userEvent.setup()
    const onOpenRequest = vi.fn()
    const onOpenSystem = vi.fn()
    renderTree({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')],
      onOpenRequest,
      onOpenSystem
    })
    await user.click(screen.getByRole('button', { name: /Design system/u }))
    await user.click(screen.getByRole('button', { name: /^Set r1/u }))
    expect(onOpenSystem).toHaveBeenCalledWith('nexus')
    expect(onOpenRequest).toHaveBeenCalledWith('r1')
  })

  it('marks the selected design system and no set while a design system is open', () => {
    renderTree({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')],
      selectedProjectKey: 'nexus'
    })
    expect(screen.getByRole('button', { name: /Design system/u })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(screen.getByRole('button', { name: /^Set r1/u })).not.toHaveAttribute('aria-current')
  })

  it('marks the selected set', () => {
    renderTree({ sets: [set('r1', NEXUS), set('r2', NEXUS)], selectedRequestId: 'r2' })
    expect(screen.getByRole('button', { name: /^Set r2/u })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /^Set r1/u })).not.toHaveAttribute('aria-current')
  })

  it('collapses a project from its header, hiding its design system row and sets', async () => {
    const user = userEvent.setup()
    const onToggleCollapsed = vi.fn()
    renderTree({
      sets: [set('r1', NEXUS)],
      designSystems: [system('nexus', 'nexuscare', 'detected')],
      collapsed: new Set(['prototypes-project:nexus']),
      onToggleCollapsed
    })
    const header = screen.getByRole('button', { name: 'nexuscare' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Design system/u })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Set r1/u })).toBeNull()

    await user.click(header)
    expect(onToggleCollapsed).toHaveBeenCalledWith('prototypes-project:nexus')
  })

  it('shows the number of prototypes on each page instead of its age', () => {
    const versions = (letter: string): PrototypeListedSet['directions'][number] => ({
      letter,
      versions: [
        { version: 1, fileName: `prototypes/r1/${letter}.html`, mtime: Date.now() - 86_400_000 }
      ]
    })
    renderTree({
      sets: [
        set('r1', NEXUS, {
          chatTitle: 'Checkout',
          count: 3,
          directions: [versions('A'), versions('B'), versions('C')]
        })
      ]
    })
    const row = screen.getByRole('button', { name: /^Checkout/ })
    expect(within(row).getByText('3')).toBeInTheDocument()
    expect(within(row).queryByText('1d')).toBeNull()
  })

  it('keeps a long title on one line and names the full title in its tooltip', async () => {
    const title = 'A long prototype title that would wrap onto a second line in the sidebar'
    renderTree({ sets: [set('r1', NEXUS, { title })] })
    const label = screen.getByText(title)
    expect(label).toHaveClass('truncate')
    fireEvent.pointerMove(label, { pointerType: 'mouse' })
    expect(await screen.findByRole('tooltip')).toHaveTextContent(title)
  })

  it('has no agent filter', () => {
    renderTree({ sets: [set('r1', NEXUS)] })
    expect(screen.queryByRole('group', { name: 'Filter by agent' })).toBeNull()
    for (const name of ['All', 'Claude', 'Codex', 'Stitch', 'Gentle Shell']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })
})

describe('PrototypeSidebarTree Archived group', () => {
  afterEach(() => {
    cleanup()
    actions.run.mockReset()
  })

  it('shows no group while nothing is archived', () => {
    renderTree({ sets: [set('r1', NEXUS)] })
    expect(screen.queryByRole('button', { name: /Archived/u })).toBeNull()
  })

  it('comes last, collapsed with its count, and keeps archived sets out of the main list', async () => {
    const user = userEvent.setup()
    renderTree({
      sets: [set('r1', NEXUS), set('r2', NEXUS, { archived: true, chatTitle: 'Old pricing' })]
    })
    const heading = screen.getByRole('button', { name: /Archived/u })
    expect(heading).toHaveTextContent('Archived1')
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Old pricing')).toBeNull()
    expect(screen.getByText('Set r1').compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )

    await user.click(heading)
    expect(screen.getByText('Old pricing')).toBeInTheDocument()
  })

  it('opens an archived set like any row, and unarchives it', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('done')
    const onOpenRequest = vi.fn()
    const { reload } = renderTree({
      sets: [set('r2', NEXUS, { archived: true, chatTitle: 'Old pricing' })],
      onOpenRequest
    })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    await user.click(screen.getByRole('button', { name: /^Old pricing/u }))
    expect(onOpenRequest).toHaveBeenCalledWith('r2')

    await user.click(screen.getByRole('button', { name: 'Actions for Old pricing' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Unarchive' }))
    await waitFor(() =>
      expect(actions.run).toHaveBeenCalledWith(
        'unarchive',
        expect.objectContaining({ requestId: 'r2' })
      )
    )
    expect(reload).toHaveBeenCalled()
  })

  it('keeps Unarchive and Delete in the row menu, not under the row', async () => {
    const user = userEvent.setup()
    renderTree({
      sets: [set('r2', NEXUS, { archived: true, deletable: true, chatTitle: 'Gone chat' })]
    })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    expect(screen.queryByRole('button', { name: 'Unarchive' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Actions for Gone chat' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Unarchive',
      'Delete'
    ])
  })

  it('shows the prototype count on an archived row too', async () => {
    const user = userEvent.setup()
    renderTree({ sets: [set('r2', NEXUS, { archived: true, chatTitle: 'Old pricing' })] })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    const row = screen.getByRole('button', { name: /^Old pricing/u })
    expect(within(row).getByText('1')).toBeInTheDocument()
  })

  it('deletes a set whose chat is gone straight from its row, without archiving it first', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('done')
    renderTree({
      sets: [
        set('r1', NEXUS, { deletable: true, chatTitle: 'Orphan' }),
        set('r3', NEXUS, { chatTitle: 'Live chat' })
      ]
    })
    await user.click(screen.getByRole('button', { name: 'Actions for Orphan' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Archive',
      'Delete'
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(actions.run).toHaveBeenCalledWith('delete', expect.objectContaining({ requestId: 'r1' }))
    )

    await user.click(screen.getByRole('button', { name: 'Actions for Live chat' }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Archive'])
  })

  it('offers Delete only for a set the host lists as deletable, and asks before deleting', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('done')
    renderTree({
      sets: [
        set('r2', NEXUS, { archived: true, deletable: true, chatTitle: 'Gone chat' }),
        set('r3', NEXUS, { archived: true, chatTitle: 'Live chat' })
      ]
    })
    await user.click(screen.getByRole('button', { name: /Archived/u }))
    await user.click(screen.getByRole('button', { name: 'Actions for Live chat' }))
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Actions for Gone chat' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Delete this prototype set?')
    expect(dialog).toHaveTextContent('Gone chat')
    expect(actions.run).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Actions for Gone chat' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(actions.run).toHaveBeenCalledWith(
        'delete',
        expect.objectContaining({ requestId: 'r2' })
      )
    )
    expect(actions.run).toHaveBeenCalledTimes(1)
  })

  it('archives a set from its row menu', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('done')
    renderTree({ sets: [set('r1', NEXUS, { chatTitle: 'Checkout' })] })
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    await waitFor(() =>
      expect(actions.run).toHaveBeenCalledWith(
        'archive',
        expect.objectContaining({ requestId: 'r1' })
      )
    )
  })

  it('moves the selection to the next set when the open one is archived', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('done')
    const onSelectRequest = vi.fn()
    renderTree({
      sets: [
        set('r1', NEXUS, { chatTitle: 'Checkout' }),
        set('r2', NEXUS, { chatTitle: 'Pricing' })
      ],
      selectedRequestId: 'r1',
      onSelectRequest
    })
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect(onSelectRequest).toHaveBeenCalledWith('r2')
  })

  it('keeps one row menu open: opening another row menu closes the previous one', () => {
    renderTree({
      sets: [
        set('r1', NEXUS, { chatTitle: 'Checkout' }),
        set('r2', NEXUS, { chatTitle: 'Pricing' })
      ]
    })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Checkout' }), {
      key: 'Enter'
    })
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Pricing', hidden: true }), {
      key: 'Enter'
    })
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Actions for Pricing', hidden: true })
    ).toHaveAttribute('data-state', 'open')
    expect(
      screen.getByRole('button', { name: 'Actions for Checkout', hidden: true })
    ).toHaveAttribute('data-state', 'closed')
  })

  it('drops the row actions of a host that predates archiving', async () => {
    const user = userEvent.setup()
    actions.run.mockResolvedValue('unsupported')
    renderTree({ sets: [set('r1', NEXUS, { chatTitle: 'Checkout' })] })
    await user.click(screen.getByRole('button', { name: 'Actions for Checkout' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Actions for Checkout' })).toBeNull()
    )
  })
})
