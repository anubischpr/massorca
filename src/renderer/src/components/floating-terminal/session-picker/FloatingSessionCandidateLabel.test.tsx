// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const runtime = vi.hoisted(() => ({ current: 'gentle-shell' as string }))
vi.mock('@/lib/use-pi-runtime', () => ({ usePiDisplayRuntime: () => runtime.current }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { FloatingSessionCandidateLabel } from './FloatingSessionCandidateLabel'

describe('a floating session picker row name', () => {
  afterEach(cleanup)

  it('names a Gentle Shell chat on its placeholder name as Gentle Shell, never Pi', () => {
    render(
      <FloatingSessionCandidateLabel
        candidate={{ agent: 'pi', label: 'Pi Chat', worktreeId: 'vps-worktree' }}
      />
    )
    expect(screen.getByText('Gentle Shell Chat')).toBeTruthy()
  })

  it('keeps a chat name the conversation gave it', () => {
    render(
      <FloatingSessionCandidateLabel
        candidate={{ agent: 'pi', label: 'Pendientes del proyecto', worktreeId: 'vps-worktree' }}
      />
    )
    expect(screen.getByText('Pendientes del proyecto')).toBeTruthy()
  })
})
