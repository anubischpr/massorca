import { createElement, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hostWallTime } from '../../../src/shared/bot-team-routine-schedule'
import { MobileBotTeamRoutineScreens } from './MobileBotTeamRoutineScreens'

const alert = vi.hoisted(() => vi.fn())
const writeText = vi.hoisted(() => vi.fn(async () => {}))
const zone = vi.hoisted((): { current: string | null } => ({ current: 'America/Bogota' }))
vi.mock('../../../src/shared/bot-team-routine-zone', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/shared/bot-team-routine-zone')>()),
  localTimeZone: () => zone.current
}))
vi.mock('react-native', () => ({
  Alert: { alert },
  FlatList: ({
    data,
    keyExtractor,
    renderItem
  }: {
    data: readonly string[]
    keyExtractor: (item: string) => string
    renderItem: (info: { item: string }) => ReactElement
  }) =>
    createElement(
      'FlatList',
      null,
      data.map((item) => createElement('Row', { key: keyExtractor(item) }, renderItem({ item })))
    ),
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  ChevronDown: 'ChevronDown',
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Pencil: 'Pencil',
  Plug: 'Plug',
  Trash2: 'Trash2'
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

beforeEach(() => {
  zone.current = 'America/Bogota'
})

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

const fieldValue = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0].props.value

const createDisabled = (renderer: ReactTestRenderer): boolean =>
  renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.children.includes('Create routine')).length > 0
  )[0].props.accessibilityState.disabled

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

  it('goes back to the room when the list was opened from the room menu', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF }
    })
    const { renderer, props } = await render(client, {
      name: 'routines',
      teamId: 'team',
      origin: 'room'
    })
    await press(renderer, 'Open Monday check-in')
    expect(props.onScreen).toHaveBeenLastCalledWith({
      name: 'routineRuns',
      teamId: 'team',
      routineId: 'r1',
      origin: 'room'
    })
    await press(renderer, 'Back')
    expect(props.onScreen).toHaveBeenLastCalledWith({ name: 'team', teamId: 'team' })
  })

  it('archives a Once routine that ran, closed by default with its count and no switch', async () => {
    const ran = {
      ...ROUTINE,
      id: 'r2',
      name: 'Launch flyer',
      schedule: {
        frequency: 'once',
        time: '15:00',
        weekday: null,
        monthDay: null,
        date: '2026-11-03'
      },
      nextRun: null
    }
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE, ran] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF }
    })
    const { renderer } = await render(client, { name: 'routines', teamId: 'team' })
    expect(text(renderer)).toContain('Archived 1')
    expect(text(renderer)).not.toContain('Launch flyer')
    await press(renderer, 'Archived 1')
    expect(text(renderer)).toContain('Launch flyer')
    // Only the active routine has the On and Paused switch.
    expect(renderer.root.findAll((node) => node.children.includes('Paused'))).toHaveLength(1)
  })

  it('edits a routine from the sheet its long press opens', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF }
    })
    const { renderer, props } = await render(client, { name: 'routines', teamId: 'team' })
    const row = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Open Monday check-in'
    )[0]
    await act(async () => row.props.onLongPress())
    await press(renderer, 'Edit')
    expect(props.onScreen).toHaveBeenLastCalledWith({
      name: 'routineEdit',
      teamId: 'team',
      routineId: 'r1'
    })
  })

  it('deletes a routine only after the alert confirms it', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.listWebhooks': { webhooks: [], endpoint: OFF },
      'botTeams.deleteRoutine': { deleted: true }
    })
    const { renderer } = await render(client, { name: 'routines', teamId: 'team' })
    const row = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Open Monday check-in'
    )[0]
    await act(async () => row.props.onLongPress())
    await press(renderer, 'Delete')
    expect(alert).toHaveBeenLastCalledWith(
      'Delete Monday check-in?',
      expect.any(String),
      expect.any(Array)
    )
    expect(client.sendRequest).not.toHaveBeenCalledWith(
      'botTeams.deleteRoutine',
      expect.anything(),
      expect.anything()
    )
    const buttons: { text: string; onPress?: () => void }[] = alert.mock.lastCall?.[2] ?? []
    await act(async () => buttons.find((button) => button.text === 'Delete')?.onPress?.())
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.deleteRoutine',
      { routineId: 'r1' },
      expect.anything()
    )
    expect(text(renderer)).not.toContain('Monday check-in')
  })

  it('opens Edit routine filled in and saves it in place of creating one', async () => {
    const client = host({
      'botTeams.listRoutines': { routines: [ROUTINE] },
      'botTeams.updateRoutine': { routine: ROUTINE }
    })
    const { renderer, props } = await render(client, {
      name: 'routineEdit',
      teamId: 'team',
      routineId: 'r1'
    })
    expect(text(renderer)).toContain('Edit routine')
    expect(fieldValue(renderer, 'Name')).toBe('Monday check-in')
    await type(renderer, 'Name', 'Monday review')
    await press(renderer, 'Save')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.updateRoutine',
      expect.objectContaining({ routineId: 'r1', botId: 'bot', name: 'Monday review' }),
      expect.anything()
    )
    expect(client.sendRequest).not.toHaveBeenCalledWith(
      'botTeams.createRoutine',
      expect.anything(),
      expect.anything()
    )
    expect(props.onScreen).toHaveBeenLastCalledWith({ name: 'routines', teamId: 'team' })
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
        schedule: {
          frequency: 'weekly',
          time: '09:00',
          weekday: 5,
          monthDay: null,
          date: null,
          timeZone: 'America/Bogota'
        }
      },
      expect.anything()
    )
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'routines', teamId: 'team' })
    await press(renderer, 'Change in Settings')
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'settings' })
  })

  it('creates a one-time routine on the date it names, starting on tomorrow', async () => {
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer, props } = await render(client, { name: 'routineNew', teamId: 'team' })
    await type(renderer, 'Name', 'Wednesday check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Once')
    expect(fieldValue(renderer, 'Date')).toBe(hostWallTime(Date.now() + 86_400_000).date)
    await type(renderer, 'Date', '2026-11-04')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenCalledWith(
      'botTeams.createRoutine',
      {
        teamId: 'team',
        botId: 'bot',
        name: 'Wednesday check-in',
        prompt: 'List what is open.',
        schedule: {
          frequency: 'once',
          time: '09:00',
          weekday: null,
          monthDay: null,
          date: '2026-11-04',
          timeZone: 'America/Bogota'
        }
      },
      expect.anything()
    )
    expect(props.onScreen).toHaveBeenCalledWith({ name: 'routines', teamId: 'team' })
  })

  it('keeps Create off for a one-time routine until its date is a real day', async () => {
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer } = await render(client, { name: 'routineNew', teamId: 'team' })
    await type(renderer, 'Name', 'Wednesday check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Once')
    await type(renderer, 'Date', '2026-02-30')
    expect(text(renderer)).toContain('Enter a date as YYYY-MM-DD.')
    expect(createDisabled(renderer)).toBe(true)
    await type(renderer, 'Date', '')
    expect(createDisabled(renderer)).toBe(true)
    await type(renderer, 'Date', '2026-11-04')
    expect(text(renderer)).not.toContain('Enter a date as YYYY-MM-DD.')
    expect(createDisabled(renderer)).toBe(false)
  })

  it('creates a routine at the quick time chosen, or at a typed time under Other time', async () => {
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer } = await render(client, { name: 'routineNew', teamId: 'team' })
    await type(renderer, 'Name', 'Evening check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Evening 19:00')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      'botTeams.createRoutine',
      expect.objectContaining({ schedule: expect.objectContaining({ time: '19:00' }) }),
      expect.anything()
    )
    await press(renderer, 'Other time')
    await type(renderer, 'Type a time', '1030')
    await press(renderer, '10:30')
    expect(text(renderer)).toContain('10:30')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      'botTeams.createRoutine',
      expect.objectContaining({ schedule: expect.objectContaining({ time: '10:30' }) }),
      expect.anything()
    )
  })

  it('says the time is in this device’s zone, and sends that zone with the routine', async () => {
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer } = await render(client, { name: 'routineNew', teamId: 'team' })
    expect(text(renderer)).toContain(
      'Runs at this time in America/Bogota, your time zone, wherever the host is.'
    )
    await type(renderer, 'Name', 'Monday check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      'botTeams.createRoutine',
      expect.objectContaining({
        schedule: expect.objectContaining({ timeZone: 'America/Bogota' })
      }),
      expect.anything()
    )
  })

  it('keeps the host’s clock wording when this device cannot name its zone', async () => {
    zone.current = null
    const client = host({ 'botTeams.createRoutine': { routine: ROUTINE } })
    const { renderer } = await render(client, { name: 'routineNew', teamId: 'team' })
    expect(text(renderer)).toContain(
      'Runs at this time, on the clock of the host Marketing uses. Use 24-hour time, like 09:00.'
    )
    await type(renderer, 'Name', 'Monday check-in')
    await type(renderer, 'What should it do?', 'List what is open.')
    await press(renderer, 'Create routine')
    expect(client.sendRequest).toHaveBeenLastCalledWith(
      'botTeams.createRoutine',
      expect.objectContaining({ schedule: expect.objectContaining({ timeZone: null }) }),
      expect.anything()
    )
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

  it('says None. It ran once. for a one-time routine that has run, and shows its run on this device’s clock', async () => {
    const passed = {
      id: 'r2',
      teamId: 'team',
      botId: 'bot',
      name: 'Wednesday check-in',
      prompt: 'List what is open.',
      schedule: {
        frequency: 'once',
        time: '10:00',
        weekday: null,
        monthDay: null,
        date: '2026-11-04'
      },
      paused: false,
      nextRun: null,
      lastRun: {
        scheduledFor: { date: '2026-11-04', time: '10:00' },
        scheduledAt: new Date(2026, 10, 4, 13, 30).getTime(),
        taskId: 't1',
        error: null
      }
    }
    const client = host({
      'botTeams.listRoutines': { routines: [passed] },
      'botTeams.listRoutineRuns': {
        runs: [
          {
            id: 'k1',
            routineId: 'r2',
            scheduledFor: { date: '2026-11-04', time: '10:00' },
            scheduledAt: new Date(2026, 10, 4, 13, 30).getTime(),
            taskId: 't1',
            error: null
          }
        ]
      }
    })
    const { renderer } = await render(client, {
      name: 'routineRuns',
      teamId: 'team',
      routineId: 'r2'
    })
    const screen = text(renderer)
    expect(screen).toContain('None. It ran once.')
    expect(screen).not.toContain('Paused.')
    expect(screen).toContain('Wed 4 Nov, 13:30')
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
