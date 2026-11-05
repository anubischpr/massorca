import { describe, expect, it, vi } from 'vitest'

// Why: the real lucide-react-native ESM build does not load under vitest here; other mobile tests stub it the same way.
vi.mock('lucide-react-native', () => ({
  Bell: 'Bell',
  Globe: 'Globe',
  Info: 'Info',
  MessageSquare: 'MessageSquare',
  Mic: 'Mic',
  Store: 'Store',
  Terminal: 'Terminal',
  Wrench: 'Wrench'
}))

import { mobileSettingsMenuItems } from './mobile-settings-menu-items'

describe('mobileSettingsMenuItems', () => {
  it('lists Marketplace right after Notifications and opens the Marketplace screen', () => {
    const routes: string[] = []
    const items = mobileSettingsMenuItems((route) => {
      routes.push(route)
    })
    const labels = items.map((item) => item.label)

    expect(labels.indexOf('Marketplace')).toBe(labels.indexOf('Notifications') + 1)
    items.find((item) => item.label === 'Marketplace')?.onPress()
    expect(routes).toEqual(['/marketplace'])
  })
})
