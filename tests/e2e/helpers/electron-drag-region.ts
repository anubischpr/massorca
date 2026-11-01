import type { Page } from '@stablyai/playwright-test'

/**
 * Electron resolves -webkit-app-region in DOM order (later elements win), and a drag region
 * swallows the click. Playwright clicks bypass that, so this reads the same rule at a button's
 * centre.
 */
export async function isDraggableAtCentre(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((target) => {
    const button = document.querySelector(target)
    if (!button) {
      throw new Error(`Missing ${target}`)
    }
    const rect = button.getBoundingClientRect()
    const x = rect.x + rect.width / 2
    const y = rect.y + rect.height / 2
    let draggable = false
    for (const element of document.querySelectorAll('*')) {
      const region = getComputedStyle(element).getPropertyValue('-webkit-app-region')
      if (region !== 'drag' && region !== 'no-drag') {
        continue
      }
      const box = element.getBoundingClientRect()
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        draggable = region === 'drag'
      }
    }
    return draggable
  }, selector)
}
