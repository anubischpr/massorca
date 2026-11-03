import { createElement, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vitest'
import { MobileBotTeamRoutineTimePicker } from './MobileBotTeamRoutineTimePicker'

vi.mock('../components/BottomDrawer', () => ({
  BottomDrawer: ({ visible, children }: { visible: boolean; children: unknown }) =>
    visible ? children : null
}))
vi.mock('react-native', () => ({
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
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({ Check: 'Check' }))

async function render(value: string, onChange = vi.fn()): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(createElement(MobileBotTeamRoutineTimePicker, { value, onChange }))
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

const type = async (renderer: ReactTestRenderer, label: string, value: string) => {
  const input = renderer.root.findAll((node) => node.props.accessibilityLabel === label)[0]
  await act(async () => input.props.onChangeText(value))
}

/** The chip that carries `label`; read it while the sheet is closed, so only the chip matches. */
const chip = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll(
    (node) =>
      typeof node.props.onPress === 'function' &&
      node.findAll((child) => child.children.includes(label)).length > 0
  )[0]

const rows = (renderer: ReactTestRenderer) =>
  renderer.root.findAll((node) => String(node.type) === 'Row')

/** The pressable row of the open list that shows `time`. */
const listRow = (renderer: ReactTestRenderer, time: string) =>
  rows(renderer)
    .find((row) => row.findAll((child) => child.children.includes(time)).length > 0)
    ?.findAll((node) => typeof node.props.onPress === 'function')[0]

describe('MobileBotTeamRoutineTimePicker', () => {
  it('offers four quick times, and Other time for any other', async () => {
    const renderer = await render('09:00')
    const screen = text(renderer)
    expect(screen).toContain('Morning 09:00')
    expect(screen).toContain('Noon 12:00')
    expect(screen).toContain('Afternoon 15:00')
    expect(screen).toContain('Evening 19:00')
    expect(screen).toContain('Other time')
    expect(chip(renderer, 'Morning 09:00').props.accessibilityState.selected).toBe(true)
    expect(chip(renderer, 'Noon 12:00').props.accessibilityState.selected).toBe(false)
  })

  it('chooses a quick time with one tap', async () => {
    const onChange = vi.fn()
    const renderer = await render('09:00', onChange)
    await press(renderer, 'Noon 12:00')
    expect(onChange).toHaveBeenCalledWith('12:00')
  })

  it('shows a time chosen under Other time in that chip’s place, marked as chosen', async () => {
    const renderer = await render('10:30')
    expect(text(renderer)).not.toContain('Other time')
    expect(chip(renderer, '10:30').props.accessibilityState.selected).toBe(true)
    expect(chip(renderer, 'Morning 09:00').props.accessibilityState.selected).toBe(false)
  })

  it('opens Other time as a sheet of 15-minute steps, each row 48pt tall', async () => {
    const renderer = await render('09:00')
    expect(rows(renderer)).toHaveLength(0)
    await press(renderer, 'Other time')
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Type a time')
    ).toHaveLength(1)
    expect(rows(renderer)).toHaveLength(96)
    expect(listRow(renderer, '00:15')?.props.style).toMatchObject({ height: 48 })
  })

  it('checks the time chosen in the list, and hands over a picked row, then closes', async () => {
    const onChange = vi.fn()
    const renderer = await render('10:30', onChange)
    await press(renderer, '10:30')
    expect(
      listRow(renderer, '10:30')?.findAll((node) => String(node.type) === 'Check')
    ).toHaveLength(1)
    expect(
      listRow(renderer, '10:45')?.findAll((node) => String(node.type) === 'Check')
    ).toHaveLength(0)
    await press(renderer, '10:45')
    expect(onChange).toHaveBeenCalledWith('10:45')
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Type a time')
    ).toHaveLength(0)
  })

  it('narrows the list to what is typed, and says so when it is not a time', async () => {
    const renderer = await render('09:00')
    await press(renderer, 'Other time')
    await type(renderer, 'Type a time', '930')
    expect(rows(renderer)).toHaveLength(1)
    expect(listRow(renderer, '09:30')).toBeDefined()
    await type(renderer, 'Type a time', 'abc')
    expect(rows(renderer)).toHaveLength(0)
    expect(text(renderer)).toContain('Not a time. Try 10:30.')
  })

  it('closes Other time without a change when Cancel is pressed', async () => {
    const onChange = vi.fn()
    const renderer = await render('09:00', onChange)
    await press(renderer, 'Other time')
    await press(renderer, 'Cancel')
    expect(onChange).not.toHaveBeenCalled()
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Type a time')
    ).toHaveLength(0)
  })
})
