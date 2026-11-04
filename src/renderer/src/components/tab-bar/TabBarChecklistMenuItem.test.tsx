// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TabBarChecklistMenuItem } from './TabBarChecklistMenuItem'

describe('the "+" menu Checklist entry', () => {
  afterEach(cleanup)

  it('is listed after a separator, as "Checklist", and opens the tab when chosen', async () => {
    const onNewChecklistTab = vi.fn()
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <div role="menuitem">New Terminal</div>
          <TabBarChecklistMenuItem onNewChecklistTab={onNewChecklistTab} />
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['New Terminal', 'Checklist'])
    expect(document.querySelector('[role="separator"]')).not.toBeNull()
    fireEvent.click(items[1])
    expect(onNewChecklistTab).toHaveBeenCalledTimes(1)
  })

  it('adds "Open a session..." after Checklist only when the panel offers it', async () => {
    const onOpenSessionPicker = vi.fn()
    render(
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger>open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <TabBarChecklistMenuItem
            onNewChecklistTab={vi.fn()}
            onOpenSessionPicker={onOpenSessionPicker}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Checklist', 'Open a session...'])
    fireEvent.click(items[1])
    expect(onOpenSessionPicker).toHaveBeenCalledTimes(1)
  })
})
