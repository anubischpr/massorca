// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesignToken } from '../../../../shared/prototype-design-system-tokens'
import { collapsedTokens, TokenChipRow } from './PrototypeDesignSystemRows'

const TOKENS: DesignToken[] = Array.from({ length: 7 }, (_unused, index) => ({
  id: `color.c${index}`,
  group: 'color',
  name: `c${index}`,
  type: 'color',
  value: '#000000'
}))

afterEach(cleanup)

describe('collapsedTokens', () => {
  it('shows the first four, and the bound token among them even when it is later in the list', () => {
    const shown = collapsedTokens(TOKENS, 'color.c6', false).map((token) => token.id)
    expect(shown).toEqual(['color.c6', 'color.c0', 'color.c1', 'color.c2'])
  })

  it('shows every token when open, and every token when there are four or fewer', () => {
    expect(collapsedTokens(TOKENS, 'color.c6', true)).toHaveLength(7)
    expect(collapsedTokens(TOKENS.slice(0, 4), 'color.c0', false)).toHaveLength(4)
  })
})

describe('TokenChipRow', () => {
  it('collapses to four chips with +N more, and shows the rest on Show less', async () => {
    const user = userEvent.setup()
    render(<TokenChipRow label="Fill" tokens={TOKENS} value="color.c5" onPick={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'color.c5' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'color.c3' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '+3 more' }))
    expect(screen.getByRole('button', { name: 'color.c3' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.queryByRole('button', { name: 'color.c3' })).toBeNull()
  })

  it('reports the chip picked, and marks the bound one pressed', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(
      <TokenChipRow label="Fill" tokens={TOKENS.slice(0, 2)} value="color.c1" onPick={onPick} />
    )
    expect(screen.getByRole('button', { name: 'color.c1' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'color.c0' }))
    expect(onPick).toHaveBeenCalledWith('color.c0')
  })

  it('keeps the custom swatch and the hex field for a color row, and commits a complete hex', async () => {
    const user = userEvent.setup()
    const onHex = vi.fn()
    render(
      <TokenChipRow
        label="Fill"
        tokens={TOKENS.slice(0, 1)}
        value="#abcdef"
        onPick={vi.fn()}
        customColor={{ hex: '#abcdef', onHex }}
      />
    )
    const hex = screen.getByRole('textbox', { name: 'Hex' })
    await user.clear(hex)
    await user.type(hex, '#123456')
    expect(onHex).toHaveBeenLastCalledWith('#123456')
  })
})
