import { describe, expect, it } from 'vitest'
import { botAgentPiRuntime } from './bot-team-character-art'
import { botModelOptionsFromListing } from './bot-team-model-options'
import { botTeamOverallStatus } from './bot-team-overall-status'

describe('botTeamOverallStatus', () => {
  it('puts what needs the person first', () => {
    expect(botTeamOverallStatus(['Working', 'Waiting for you'])).toBe('Waiting for you')
  })
  it('reads running work', () => {
    expect(botTeamOverallStatus(['Done', 'Working'])).toBe('Working')
  })
  it('reads nothing running without live work', () => {
    expect(botTeamOverallStatus([])).toBe('Nothing running')
    expect(botTeamOverallStatus(['Done', 'Stopped', 'Stuck', 'Not started'])).toBe(
      'Nothing running'
    )
  })
})

describe('botAgentPiRuntime', () => {
  it('makes a bot on pi Gentle Shell, never stock Pi', () => {
    expect(botAgentPiRuntime('pi')).toBe('gentle-shell')
    expect(botAgentPiRuntime('claude')).toBeUndefined()
  })
})

describe('botModelOptionsFromListing', () => {
  it('uses the host listing and its efforts', () => {
    const options = botModelOptionsFromListing('pi', [
      { id: 'm', label: 'M', efforts: [{ value: 'high', label: 'High' }] }
    ] as never)
    expect(options).toEqual([{ id: 'm', label: 'M', efforts: [{ value: 'high', label: 'High' }] }])
  })

  it('gives an Antigravity model the efforts the agent declares for listed slugs', () => {
    const [option] = botModelOptionsFromListing('antigravity', [
      { id: 'slug', label: 'Slug', efforts: [] }
    ] as never)
    expect(option.efforts.length).toBeGreaterThan(0)
  })

  it('offers no effort for an agent that declares none', () => {
    const [option] = botModelOptionsFromListing('pi', [
      { id: 'm', label: 'M', efforts: [] }
    ] as never)
    expect(option.efforts).toEqual([])
  })
})
