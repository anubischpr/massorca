// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VaultAutomatedRunsSwitch } from './AiVaultPanelControls'

afterEach(cleanup)

describe('VaultAutomatedRunsSwitch', () => {
  it('labels the switch and shows the scope count beside it, muted', () => {
    render(<VaultAutomatedRunsSwitch checked={false} count={1021} onCheckedChange={vi.fn()} />)

    const toggle = screen.getByRole('switch', { name: 'Automated runs' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('1021')).toHaveClass('text-muted-foreground')
  })

  it('reports the value it is switched to', () => {
    const onCheckedChange = vi.fn()
    render(<VaultAutomatedRunsSwitch checked={false} count={3} onCheckedChange={onCheckedChange} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Automated runs' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('reflects a switch that is on', () => {
    render(<VaultAutomatedRunsSwitch checked count={3} onCheckedChange={vi.fn()} />)

    expect(screen.getByRole('switch', { name: 'Automated runs' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })
})
