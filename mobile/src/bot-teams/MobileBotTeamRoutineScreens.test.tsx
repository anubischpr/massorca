import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamRoutineScreens } from './MobileBotTeamRoutineScreens'

const alert = vi.hoisted(() => vi.fn())
const writeText = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('react-native', () => ({
  Alert: { alert },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Plug: 'Plug'
}))
vi.mock('../platform/clipboard', () => ({ useClipboardWriter: () => ({ writeText }) }))
vi.mock('./MobileBotAgentIcon', () => ({ MobileBotAgentIcon: 'MobileBotAgentIcon' }))
vi.mock('./use-mobile-bot-team-room', () => ({
  useMobileBotTeamRoom: () => ({
    room: {
      workspaceId: 'ws',
      tasks: [
        {
          id: 't1',
          teamId: 'team',
          title: 'Monday check-in',
          prompt: '',
          ownerBotId: 'bot',
          sessionId: 's1',
          projectId: null
        }
      ]
    },
    reload: vi.fn()
  })
}))
vi.mock('./use-mobile-bot-team-task-status', () => ({
  useMobileBotTeamTaskStatus: () => () => 'Done'
}))

const TEAM = {
  id: 'team',
  name: 'Marketing',
  purpose: '',
  character: 'circle' as const,
  workspacesEnabled: false,
  accessMode: 'full-access' as const,
  bots: [
    {
      id: 'bot',
      name: 'Nora',
      job: 'Writes the copy',
      agent: 'claude' as const,
      modelMode: 'auto' as const,
      model: null,
      effort: null,
      skills: []
    }
  ]
}
const ROUTINE = {
  id: 'r1',
  teamId: 'team',
  botId: 'bot',
  name: 'Monday check-in',
  prompt: 'List what is open.',
  schedule: { frequency: 'weekly', time: '09:00', weekday: 1, monthDay: null },
  paused: false,
  nextRun: { date: '2026-11-09', time: '09:00' },
  lastRun: { scheduledFor: { date: '2026-11-02', time: '09:00' }, taskId: 't1', error: null }
}
const HOOK = { id: 'h1', teamId: 'team', botId: 'bot', lastCall: null }
const OFF = { state: 'unavailable' }

function host(answers: Record<string, unknown>) {
  const sendRequest = vi.fn(async (method: string) => {
    const reply = answers[method]
    return reply === undefined
      ? { ok: false, error: { code: 'method_not_found', message: 'nope' } }
      : { ok: true, result: reply }
  })
  return { sendRequest }
}

async function render(
  client: { sendRequest: unknown },
  screen: Parameters<typeof MobileBotTeamRoutineScreens>[0]['screen'],
  extras: Partial<Parameters<typeof MobileBotTeamRoutineScreens>[0]> = {}
) {
  const props = {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The screens only call sendRequest.
    client: client as never,
    teams: [TEAM],
    offline: false,
    screen,
    onScreen: vi.fn(),
    onOpenTask: vi.fn(),
    ...extras
  }
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamRoutineScreens, props))
  })
  // The web address screen is loaded on demand.
  for (let wait = 0; wait < 100 && renderer.toJSON() === null; wait += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
  }
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
  return { renderer, props }
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON())

const press = async (renderer: ReactTestRenderer, label: string, index = 0) => {
  const target = renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      (node.props.accessibilityLabel === label ||
        node.findAll((child) => child.children.includes(label)).length > 0)
  )[index]
  await act(async () => target.props.onPress())
}

const type = async (renderer: ReactTestRenderer, label: string, value: string) => {
  const input = renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0]
  await act(async () => input.props.onChangeText(value))
}

describe('Routines on the phone', () => {
  it('lists the routines with their schedule and last run, and the web addresses under them', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listWebhooks': { webhooks: [HOOK], endpoint: OFF }
    })
    const { renderer, props } = await render(client, { name: 'routines', teamId: 'team' })
    const screen = text(renderer)
    expect(screen).toContain(
      'Routines start a task on a schedule. Each run is kept in its history.'
    )
    expect(screen).toContain('Every Monday at 09:00, Nora')
    expect(screen).toContain('Last run Mon 2 Nov, done. Next run Mon 9 Nov, 09:00.')
    expect(screen).toContain('Web addresses')
    expect(screen).toContain('Start a task from another app')
    expect(screen).toContain('Nora. One task for each call. No calls yet.')
    expect(screen).toContain('This host does not take calls yet.')
    await press(renderer, 'Open Monday check-in')
    expect(props.onScreen).toHaveBeenCalledWith({
      name: 'routineRuns',
      teamId: 'team',
      routineId: 'r1'
    })
    await press(renderer, 'Open web address')
    expect(props.onScreen).toHaveBeenCalledWith({
      name: 'webhook',
      teamId: 'team',
      webhookId: 'h1'
    })
    await press(renderer, 'New routine')
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'routineNew', teamId: 'team' })
  })

  it('shows the empty states with a way to add each', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF }
    })
    const { renderer, props } = await render(client, { name: 'routines', teamId: 'team' })
    const screen = text(renderer)
    expect(screen).toContain('No routines yet')
    expect(screen).toContain(
      'A routine starts a task with one bot in Marketing, on the schedule you choose.'
    )
    expect(screen).toContain('No web addresses yet')
    await press(renderer, 'New web address')
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'webhook', teamId: 'team' })
  })

  it('pauses a routine from its switch', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF },
      'botTeams.setRoutinePaused': { routine: { ...ROUTINE, paused: true, nextRun: null } }
    })
    const { renderer } = await render(client, { name: 'routines', teamId: 'team' })
    await press(renderer, 'Paused')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.setRoutinePaused',
      { routineId: 'r1', paused: true },
      expect.anything()
    )
    expect(text(renderer)).toContain('Last run Mon 2 Nov, done. Paused.')
  })

  it('says so on a host that cannot run routines', async () => {
    const { renderer } = await render(host({}), { name: 'routines', teamId: 'team' })
    expect(text(renderer)).toContain('This host cannot run routines yet.')
    expect(text(renderer)).not.toContain('New routine')
  })

  it('creates a routine for the chosen bot', async () => {
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer, props } = await render(client, { name: 'routineNew', teamId: 'team' })
    expect(text(renderer)).toContain('Set for Marketing in Settings. This routine uses it.')
    await type(renderer, 'Name', 'Monday check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Fri')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.createRoutine',
      {
        teamId: 'team',
        botId: 'bot',
        name: 'Monday check-in',
        prompt: 'List what is open.',
        schedule: { frequency: 'weekly', time: '09:00', weekday: 5, monthDay: null }
      },
      expect.anything()
    )
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'routines', teamId: 'team' })
    await press(renderer, 'Change in Settings')
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'settings' })
  })

  it('lists the runs of a routine with the state of each task', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listRoutineRuns': {
        runs: [
          {
            id: 'k1',
            routineId: 'r1',
            scheduledFor: { date: '2026-11-02', time: '09:00' },
            taskId: 't1',
            error: null
          },
          {
            id: 'k2',
            routineId: 'r1',
            scheduledFor: { date: '2026-10-26', time: '09:00' },
            taskId: null,
            error: 'The routine’s bot is no longer on the team.'
          }
        ]
      }
    })
    const { renderer, props } = await render(client, {
      name: 'routineRuns',
      teamId: 'team',
      routineId: 'r1'
    })
    const screen = text(renderer)
    expect(screen).toContain('Mon 2 Nov, 09:00')
    expect(screen).toContain('Made the task “Monday check-in”.')
    expect(screen).toContain('Did not start')
    expect(screen).toContain('The routine’s bot is no longer on the team.')
    await press(renderer, 'Open task Monday check-in')
    expect(props.onOpenTask).toHaveBeenCalledWith('ws', expect.objectContaining({ id: 't1' }))
  })
})

describe('Web address on the phone', () => {
  const made = { webhook: HOOK, secret: 'whsec_PHONESECRET', endpoint: OFF }

  it('makes an address and shows the key once, with a way to copy it', async () => {
    const client = host({
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF },
      'botTeams.createWebhook': made
    })
    const { renderer, props } = await render(client, { name: 'webhook', teamId: 'team' })
    expect(text(renderer)).toContain('This host does not take calls yet')
    await press(renderer, 'Create web address')
    const screen = text(renderer)
    expect(screen).toContain('/hooks/marketing/h1')
    expect(screen).toContain('whsec_PHONESECRET')
    expect(screen).toContain("Shown once. Copy it now and keep it safe. You won't see it again.")
    await press(renderer, 'Copy key')
    expect(writeText).toHaveBeenCalledWith('whsec_PHONESECRET')
    await press(renderer, 'I have copied the key')
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'routines', teamId: 'team' })
  })

  it('never shows the key of an address that already exists, and replaces it only after asking', async () => {
    const client = host({
      'botTeams.listWebhooks': { webhooks: [HOOK], endpoint: OFF },
      'botTeams.replaceWebhookSecret': { ...made, secret: 'whsec_NEWPHONESECRET' }
    })
    const { renderer } = await render(client, { name: 'webhook', teamId: 'team', webhookId: 'h1' })
    expect(text(renderer)).toContain('The key is hidden')
    expect(text(renderer)).not.toContain('whsec_')
    await press(renderer, 'Replace key')
    expect(client.sendRequest).not.toHaveBeenCalledWith(
      'botTeams.replaceWebhookSecret',
      expect.anything(),
      expect.anything()
    )
    expect(text(renderer)).toContain('The old key stops working at once.')
    await press(renderer, 'Replace key now')
    expect(text(renderer)).toContain('whsec_NEWPHONESECRET')
  })
})
