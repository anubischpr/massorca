import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import {
  MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE,
  everyoneAccessPolicy,
  type MarketplaceAppAccessPolicy
} from '../../../src/shared/marketplace-apps'
import { withTeamAllowed } from '../../../src/shared/marketplace-access-edit'
import type { BotTeam } from '../../../src/shared/rpc-contract/bot-team-params'
import type { MarketplaceHostRpc } from '../marketplace/marketplace-host-rpc'
import type { RpcResponse } from '../transport/types'
import { MobileBotTeamMarketplaceApps } from './MobileBotTeamMarketplaceApps'

vi.mock('react-native', () => ({
  Alert: { alert: () => {} },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Switch: 'Switch',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 })
}))
vi.mock('lucide-react-native', () => ({ ChevronLeft: 'ChevronLeft', ChevronRight: 'ChevronRight' }))
vi.mock('../marketplace/marketplace-glyphs', () => ({ MarketplaceGlyph: () => null }))

function bot(id: string, agent: BotTeam['bots'][number]['agent']): BotTeam['bots'][number] {
  return { id, name: id, job: '', agent, modelMode: 'auto', model: null, effort: null, skills: [] }
}

function team(id: string, name: string, bots: BotTeam['bots'] = []): BotTeam {
  return {
    id,
    name,
    purpose: '',
    character: 'circle',
    workspacesEnabled: false,
    accessMode: 'default',
    bots
  }
}

const OPS = team('team-ops', 'Ops')
const ART = team('team-art', 'Art', [bot('bot-iris', 'antigravity')])

const ENGRAM = { id: 'engram', connected: true, agents: [], access: everyoneAccessPolicy() }
const OPENMETADATA = { id: 'openmetadata', connected: false, agents: [] }
const GITHUB_OFF_FOR_OPS = {
  id: 'github',
  connected: true,
  agents: [],
  access: { ...everyoneAccessPolicy(), bots: { mode: 'except', botIds: [], teamIds: [OPS.id] } }
}

/** A host that lists `apps`; a save is answered by `onSave`, or accepted with the first app. */
function host(apps: unknown[], onSave?: () => Promise<RpcResponse> | RpcResponse) {
  const sendRequest = vi.fn(async (method: string): Promise<RpcResponse> => {
    if (method === 'marketplace.apps.list') {
      return { id: 'list', ok: true, result: { ok: true, apps } }
    }
    if (method === 'marketplace.apps.setAccessPolicy') {
      return onSave
        ? await onSave()
        : { id: 'save', ok: true, result: { ok: true, status: apps[0] } }
    }
    throw new Error(`unexpected ${method}`)
  })
  const client: MarketplaceHostRpc = { sendRequest }
  return { client, sendRequest }
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function renderApps(client: MarketplaceHostRpc, subject: BotTeam) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      createElement(MobileBotTeamMarketplaceApps, { client, team: subject, onBack: () => {} })
    )
  })
  await flush()
  return renderer
}

function switches(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => node.type === ('Switch' as never))
}

function switchNamed(renderer: ReactTestRenderer, label: string) {
  const found = switches(renderer).filter((node) => node.props.accessibilityLabel === label)
  expect(found, `a switch labelled "${label}"`).toHaveLength(1)
  return found[0]
}

async function toggle(renderer: ReactTestRenderer, label: string, value: boolean) {
  const node = switchNamed(renderer, label)
  await act(async () => {
    node.props.onValueChange(value)
  })
  await flush()
}

function text(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON())
}

describe('MobileBotTeamMarketplaceApps', () => {
  it('lists only connected apps, each switched for this team', async () => {
    const { client } = host([ENGRAM, OPENMETADATA, GITHUB_OFF_FOR_OPS])
    const renderer = await renderApps(client, OPS)
    expect(switches(renderer).map((node) => node.props.accessibilityLabel)).toEqual([
      'Let Ops use Engram',
      'Let Ops use GitHub'
    ])
    expect(switchNamed(renderer, 'Let Ops use Engram').props.value).toBe(true)
    expect(switchNamed(renderer, 'Let Ops use GitHub').props.value).toBe(false)
  })

  it('saves the team policy withTeamAllowed builds when a switch turns off', async () => {
    const { client, sendRequest } = host([ENGRAM])
    const renderer = await renderApps(client, OPS)
    await toggle(renderer, 'Let Ops use Engram', false)
    const policy = {
      ...everyoneAccessPolicy(),
      bots: withTeamAllowed(everyoneAccessPolicy().bots, OPS, false)
    }
    expect(policy.bots).toEqual({ mode: 'except', botIds: [], teamIds: [OPS.id] })
    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.setAccessPolicy', {
      id: 'engram',
      policy
    })
  })

  it('shows the Antigravity message and saves nothing when a bot there would be kept out', async () => {
    const { client, sendRequest } = host([ENGRAM])
    const renderer = await renderApps(client, ART)
    await toggle(renderer, 'Let Art use Engram', false)
    expect(text(renderer)).toContain(MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE)
    expect(sendRequest.mock.calls.map(([method]) => method)).not.toContain(
      'marketplace.apps.setAccessPolicy'
    )
  })

  it('keeps an Antigravity bot picked under Only, and shows the same message', async () => {
    const only: MarketplaceAppAccessPolicy = {
      ...everyoneAccessPolicy(),
      bots: { mode: 'only', botIds: [], teamIds: [ART.id] }
    }
    const { client, sendRequest } = host([{ ...ENGRAM, access: only }])
    const renderer = await renderApps(client, ART)
    await toggle(renderer, 'Let Art use Engram', false)
    expect(text(renderer)).toContain(MARKETPLACE_AGENT_DENIAL_UNSUPPORTED_MESSAGE)
    expect(sendRequest).toHaveBeenCalledWith('marketplace.apps.setAccessPolicy', {
      id: 'engram',
      policy: { ...only, bots: { mode: 'only', botIds: ['bot-iris'], teamIds: [] } }
    })
  })

  it('shows the empty state when no app is connected', async () => {
    const { client } = host([OPENMETADATA])
    const renderer = await renderApps(client, OPS)
    expect(switches(renderer)).toHaveLength(0)
    expect(text(renderer)).toContain(
      'No apps are connected yet. Connect them from the Marketplace.'
    )
  })

  it.each([
    [
      'the host is offline',
      vi.fn(async (): Promise<RpcResponse> => {
        throw new Error('offline')
      })
    ],
    [
      'the host predates the Marketplace apps method',
      vi.fn(async (): Promise<RpcResponse> => ({
        id: 'list',
        ok: false,
        error: { code: 'method_not_found', message: 'Unknown method' }
      }))
    ]
  ])('shows a plain message and no switches when %s', async (_case, sendRequest) => {
    const renderer = await renderApps({ sendRequest }, OPS)
    expect(switches(renderer)).toHaveLength(0)
    expect(text(renderer)).toContain('Could not load Marketplace apps.')
  })

  it('disables every switch while a save is in flight', async () => {
    let answerSave!: (response: RpcResponse) => void
    const { client } = host(
      [ENGRAM, GITHUB_OFF_FOR_OPS],
      () =>
        new Promise<RpcResponse>((resolve) => {
          answerSave = resolve
        })
    )
    const renderer = await renderApps(client, OPS)
    await act(async () => {
      switchNamed(renderer, 'Let Ops use Engram').props.onValueChange(false)
    })
    expect(switchNamed(renderer, 'Let Ops use Engram').props.disabled).toBe(true)
    expect(switchNamed(renderer, 'Let Ops use GitHub').props.disabled).toBe(true)
    await act(async () => {
      answerSave({ id: 'save', ok: true, result: { ok: true, status: ENGRAM } })
    })
    await flush()
    expect(switchNamed(renderer, 'Let Ops use Engram').props.disabled).toBe(false)
  })

  it('shows a save error plainly and keeps the switch where the host has it', async () => {
    const { client } = host([ENGRAM], () => ({
      id: 'save',
      ok: true,
      result: { ok: false, reason: 'failed' }
    }))
    const renderer = await renderApps(client, OPS)
    await toggle(renderer, 'Let Ops use Engram', false)
    expect(text(renderer)).toContain('The change did not complete. Try again.')
    expect(switchNamed(renderer, 'Let Ops use Engram').props.value).toBe(true)
  })
})
