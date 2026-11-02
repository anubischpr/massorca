/**
 * @vitest-environment happy-dom
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const listBotTeamFiles = vi.hoisted(() => vi.fn())
vi.mock('@/runtime/runtime-bot-team-client', () => ({ listBotTeamFiles }))

const { useBotTeamFilePaths } = await import('./use-bot-team-files')

const mounted: { container: HTMLDivElement; root: Root }[] = []
let latest: string[] = []

function Probe({ wanted }: { wanted: boolean }): null {
  latest = useBotTeamFilePaths('t1', wanted)
  return null
}

async function render(wanted: boolean): Promise<Root> {
  const container = document.createElement('div')
  const root = createRoot(container)
  mounted.push({ container, root })
  await act(async () => root.render(<Probe wanted={wanted} />))
  return root
}

beforeEach(() => {
  latest = []
  listBotTeamFiles.mockReset()
  listBotTeamFiles.mockResolvedValue({
    files: [
      { relativePath: 'flyer.html', basename: 'flyer.html', kind: 'text' },
      { relativePath: 'logo.png', basename: 'logo.png', kind: 'binary' }
    ],
    truncated: false
  })
})

afterEach(() => {
  for (const { root } of mounted.splice(0)) {
    act(() => root.unmount())
  }
})

describe('the file paths offered after @', () => {
  it('lists nothing until a mention is being typed', async () => {
    await render(false)
    expect(listBotTeamFiles).not.toHaveBeenCalled()
    expect(latest).toEqual([])
  })

  it('lists the team files once a mention starts, and again for the next one', async () => {
    const root = await render(true)
    expect(listBotTeamFiles).toHaveBeenCalledTimes(1)
    expect(latest).toEqual(['flyer.html', 'logo.png'])

    await act(async () => root.render(<Probe wanted={false} />))
    await act(async () => root.render(<Probe wanted />))
    expect(listBotTeamFiles).toHaveBeenCalledTimes(2)
  })

  it('offers none on a host that cannot list them, and keeps going when listing fails', async () => {
    listBotTeamFiles.mockResolvedValue('unavailable')
    const root = await render(true)
    expect(latest).toEqual([])

    listBotTeamFiles.mockRejectedValue(new Error('offline'))
    await act(async () => root.render(<Probe wanted={false} />))
    await act(async () => root.render(<Probe wanted />))
    expect(latest).toEqual([])
  })
})
