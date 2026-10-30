// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createSetState, type PrototypeSetState } from '../../../../shared/prototype-set-state'
import type { PrototypeListedSet } from '../../../../shared/rpc-contract/prototype-params'
import { PrototypeSetGrid } from './PrototypeSetGrid'
import { PrototypeThumbnail } from './PrototypeThumbnail'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, options?: Record<string, string>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '')
}))

vi.mock('./PrototypeThumbnail', () => ({ PrototypeThumbnail: vi.fn(() => null) }))

const SET: PrototypeListedSet = {
  requestId: '20261028-201500-aaaaaa',
  sessionId: 'session-alpha-0001',
  agent: 'claude',
  worktreeId: null,
  chatTitle: 'Checkout',
  originalPrompt: 'a checkout page',
  createdAt: '2026-10-28T20:15:00.000Z',
  count: 2,
  directions: [
    {
      letter: 'A',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/A.html', mtime: 1 }]
    },
    {
      letter: 'B',
      versions: [{ version: 1, fileName: 'prototypes/20261028-201500-aaaaaa/B.html', mtime: 1 }]
    }
  ]
}

function renderGrid(state: PrototypeSetState): void {
  render(
    <TooltipProvider>
      <PrototypeSetGrid set={SET} state={state} update={vi.fn()} />
    </TooltipProvider>
  )
}

/** The viewport each card's thumbnail was asked to draw at. */
function thumbnailViewports(): unknown[] {
  return vi.mocked(PrototypeThumbnail).mock.calls.map((call) => call[0].viewport)
}

describe('PrototypeSetGrid thumbnails', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(PrototypeThumbnail).mockClear()
  })

  it('draws every card at the desktop width in desktop view', () => {
    renderGrid(createSetState(['A', 'B']))
    expect(thumbnailViewports()).toEqual(['desktop', 'desktop'])
  })

  it('draws every card at the phone width in phone view', () => {
    renderGrid({ ...createSetState(['A', 'B']), viewport: 'phone' })
    expect(thumbnailViewports()).toEqual(['phone', 'phone'])
  })
})
