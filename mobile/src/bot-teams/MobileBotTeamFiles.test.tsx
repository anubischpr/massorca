import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import { MobileBotTeamFile, MobileBotTeamFiles } from './MobileBotTeamFiles'

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', FileText: 'FileText' }))
// Why: the media preview loads expo-file-system, which needs the app's __DEV__ global to import.
vi.mock('../files/MobileFileMediaPreview', () => ({ MobileFileMediaPreview: () => null }))
// Why: the real markdown view imports React Native internals this runner cannot parse; its text stands in.
vi.mock('../files/MobileFileMarkdownPreview', async () => {
  const { createElement } = await import('react')
  return {
    MobileFileMarkdownPreview: ({ content }: { content: string }) =>
      createElement('Text', null, content)
  }
})

const NOTE = 'One bot or person edits a file at a time. Every change is saved as a version.'

/** Records every request and answers with one reply. */
function hostAnswering(reply: { ok: boolean; result?: unknown; error?: unknown }) {
  const sendRequest = vi.fn(async (..._args: unknown[]) => ({
    id: '1',
    _meta: { runtimeId: 'r' },
    ...reply
  }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The file screens only call sendRequest.
  return { sendRequest, client: { sendRequest } as never as RpcClient }
}

/** The method and params of the first request the screen made. */
function firstRequest(sendRequest: ReturnType<typeof hostAnswering>['sendRequest']) {
  const [method, params] = sendRequest.mock.calls[0] ?? []
  return { method, params }
}

async function renderList(props: Partial<Parameters<typeof MobileBotTeamFiles>[0]>) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamFiles, {
        client: hostAnswering({ ok: true, result: { files: [] } }).client,
        workspaceId: 'folder:1',
        offline: false,
        onBack: vi.fn(),
        onOpenFile: vi.fn(),
        ...props
      })
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return renderer
}

async function renderFile(props: Partial<Parameters<typeof MobileBotTeamFile>[0]>) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamFile, {
        client: hostAnswering({ ok: true, result: { content: '' } }).client,
        workspaceId: 'folder:1',
        path: 'flyer.md',
        folderKnown: true,
        offline: false,
        onBack: vi.fn(),
        ...props
      })
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  return renderer
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

const press = async (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[0]
  await act(async () => target.props.onPress())
}

describe('MobileBotTeamFiles', () => {
  it('lists the team folder by path, with the edit note as drawn', async () => {
    const { client, sendRequest } = hostAnswering({
      ok: true,
      result: { files: [{ relativePath: 'flyer.md' }, { relativePath: 'prices.csv' }] }
    })
    const renderer = await renderList({ client })
    expect(firstRequest(sendRequest)).toEqual({
      method: 'files.list',
      params: { worktree: 'id:folder:1' }
    })
    expect(text(renderer)).toContain('flyer.md')
    expect(text(renderer)).toContain('prices.csv')
    expect(text(renderer)).toContain(NOTE)
  })

  it('opens the file a person taps', async () => {
    const onOpenFile = vi.fn()
    const { client } = hostAnswering({
      ok: true,
      result: { files: [{ relativePath: 'flyer.md' }] }
    })
    const renderer = await renderList({ client, onOpenFile })
    await press(renderer, 'flyer.md')
    expect(onOpenFile).toHaveBeenCalledWith('flyer.md')
  })

  it('says a folder with no files yet, without asking the host', async () => {
    const { client, sendRequest } = hostAnswering({ ok: true, result: { files: [] } })
    const renderer = await renderList({ client, workspaceId: null })
    expect(text(renderer)).toContain('No files yet.')
    expect(sendRequest).not.toHaveBeenCalled()
  })

  it('says when the host cannot list files yet', async () => {
    const { client } = hostAnswering({
      ok: false,
      error: { code: 'method_not_found', message: 'nope' }
    })
    const renderer = await renderList({ client })
    expect(text(renderer)).toContain('This host cannot list team files yet.')
  })
})

describe('MobileBotTeamFile', () => {
  it('shows the file text read-only', async () => {
    const { client, sendRequest } = hostAnswering({
      ok: true,
      result: { content: 'Flyer copy', truncated: false, byteLength: 11 }
    })
    const renderer = await renderFile({ client })
    expect(firstRequest(sendRequest)).toEqual({
      method: 'files.read',
      params: { worktree: 'id:folder:1', relativePath: 'flyer.md' }
    })
    expect(text(renderer)).toContain('Flyer copy')
    expect(renderer.root.findAll((node) => node.type === 'TextInput')).toHaveLength(0)
  })

  it('says when the host will not open the file, in the phone preview words', async () => {
    const { client } = hostAnswering({
      ok: false,
      error: { code: 'file_too_large', message: 'file_too_large' }
    })
    const renderer = await renderFile({ client })
    expect(text(renderer)).toContain('File too large for mobile preview')
    expect(text(renderer)).not.toContain('This file cannot be opened here.')
  })

  it('previews a room image through the image read, not the text read', async () => {
    const { client, sendRequest } = hostAnswering({
      ok: true,
      result: { content: 'iVBORw0KGgo=', isBinary: true, isImage: true, mimeType: 'image/png' }
    })
    const renderer = await renderFile({ client, path: 'attachments/photo.png' })
    expect(firstRequest(sendRequest)).toEqual({
      method: 'files.readPreview',
      params: { worktree: 'id:folder:1', relativePath: 'attachments/photo.png' }
    })
    expect(renderer.root.findAllByType('Image')).toHaveLength(1)
    expect(text(renderer)).not.toContain('This file cannot be opened here.')
  })

  it('waits for the room to name its folder before reading, without refusing the file', async () => {
    const { client, sendRequest } = hostAnswering({ ok: true, result: { content: 'Flyer copy' } })
    const renderer = await renderFile({ client, workspaceId: null, folderKnown: false })
    expect(sendRequest).not.toHaveBeenCalled()
    expect(text(renderer)).not.toContain('This file cannot be opened here.')
  })

  it('says a team with no folder has no file to open', async () => {
    const { client, sendRequest } = hostAnswering({ ok: true, result: { content: 'Flyer copy' } })
    const renderer = await renderFile({ client, workspaceId: null, folderKnown: true })
    expect(sendRequest).not.toHaveBeenCalled()
    expect(text(renderer)).toContain('This team has no folder yet.')
  })
})
