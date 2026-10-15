// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { getDefaultSettings } from '../../../../shared/constants'
import { PiRuntimeSetting } from './PiRuntimeSetting'

vi.mock('../ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    children
  }: {
    value: string
    onValueChange: (value: string) => void
    children: ReactNode
  }) => (
    <select
      aria-label="Pi runtime"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null
}))

describe('Pi runtime selection', () => {
  it('selects Gentle Shell through the existing Pi override and refreshes detection without changing other agents', async () => {
    const updateSettings = vi.fn(async () => {}),
      refresh = vi.fn(async () => {})
    const settings = {
      ...getDefaultSettings('/synthetic/home'),
      agentCmdOverrides: { codex: '/custom/codex' }
    }
    render(
      <PiRuntimeSetting settings={settings} updateSettings={updateSettings} refresh={refresh} />
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Pi runtime' }), {
      target: { value: 'gentle-shell' }
    })
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    expect(updateSettings).toHaveBeenCalledWith({
      agentCmdOverrides: { codex: '/custom/codex', pi: 'gentle-shell' }
    })
    expect(settings.agentCmdOverrides).toEqual({ codex: '/custom/codex' })
  })
})
