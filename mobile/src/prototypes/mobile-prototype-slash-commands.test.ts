import { describe, expect, it } from 'vitest'
import { withPrototypeSlashCommands } from './mobile-prototype-slash-commands'

describe('withPrototypeSlashCommands', () => {
  it('offers /prototype and /prototipo in front of the chat commands', () => {
    const names = withPrototypeSlashCommands([{ name: 'model' }, { name: 'clear' }]).map(
      (command) => command.name
    )
    expect(names).toEqual(['prototype', 'prototipo', 'model', 'clear'])
  })

  it('offers the prototype commands with no description or argument hint', () => {
    const commands = withPrototypeSlashCommands([]).filter((command) =>
      ['prototype', 'prototipo'].includes(command.name)
    )
    expect(commands).toEqual([{ name: 'prototype' }, { name: 'prototipo' }])
  })

  it('does not list a command the chat already lists twice', () => {
    const names = withPrototypeSlashCommands([{ name: 'prototype' }]).map((command) => command.name)
    expect(names).toEqual(['prototipo', 'prototype'])
  })
})
