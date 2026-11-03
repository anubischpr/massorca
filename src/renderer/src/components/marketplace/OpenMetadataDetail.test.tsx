// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MarketplaceDetection } from '../../../../shared/marketplace-types'
import { OpenMetadataDetail } from './OpenMetadataDetail'

const roots: Root[] = []

function detection(): MarketplaceDetection {
  return {
    engram: {
      cli: 'missing',
      store: 'missing',
      agents: { claude: 'missing', codex: 'missing' }
    },
    openMetadata: {
      agents: {
        claude: { reader: 'set', writer: 'missing' },
        codex: { reader: 'unreadable', writer: 'set' }
      }
    }
  }
}

async function renderDetail(): Promise<HTMLDivElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => {
    root.render(<OpenMetadataDetail detection={detection()} />)
  })
  return container
}

describe('OpenMetadataDetail', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount())
    })
    document.body.replaceChildren()
  })

  it('shows the reader and writer state for each agent, in order', async () => {
    const container = await renderDetail()

    const badges = Array.from(container.querySelectorAll('[data-slot="badge"]')).map(
      (badge) => badge.textContent
    )
    expect(badges).toEqual([
      'Set',
      'Not set',
      'Settings file could not be read',
      'Set',
      'Not supported yet',
      'Not supported yet'
    ])
  })

  it('offers no switches, because these entries are read-only here', async () => {
    const container = await renderDetail()

    expect(container.querySelector('[role="switch"]')).toBeNull()
  })

  it('says that connecting from MassOrca is not built yet', async () => {
    const container = await renderDetail()

    expect(container.textContent).toContain(
      'Connecting from MassOrca is coming soon. Today the entries are added by hand.'
    )
  })
})
