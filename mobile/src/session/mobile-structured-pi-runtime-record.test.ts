import { afterEach, describe, expect, it } from 'vitest'
import {
  rememberMobileStructuredPiRuntime,
  resetMobileStructuredPiRuntimesForTests,
  resolveMobileChatTabPiRuntime
} from './mobile-structured-pi-runtime-record'

describe('resolveMobileChatTabPiRuntime', () => {
  afterEach(() => resetMobileStructuredPiRuntimesForTests())

  it('trusts the host marker on the tab', () => {
    expect(resolveMobileChatTabPiRuntime({ sessionId: 'pi_1', piRuntime: 'gentle-shell' })).toBe(
      'gentle-shell'
    )
  })

  it('names Gentle Shell from the options an older host reported for an unmarked tab', () => {
    const tab = { sessionId: 'pi_1' }
    expect(resolveMobileChatTabPiRuntime(tab)).toBe('pi')

    rememberMobileStructuredPiRuntime('pi_1', 'gentle-shell')

    expect(resolveMobileChatTabPiRuntime(tab)).toBe('gentle-shell')
    expect(resolveMobileChatTabPiRuntime({ sessionId: 'pi_2' })).toBe('pi')
  })

  it('keeps the last known runtime when a reply names none or an unknown one', () => {
    rememberMobileStructuredPiRuntime('pi_1', 'gentle-shell')
    rememberMobileStructuredPiRuntime('pi_1', undefined)
    rememberMobileStructuredPiRuntime('pi_1', 'future-pi')
    expect(resolveMobileChatTabPiRuntime({ sessionId: 'pi_1' })).toBe('gentle-shell')

    rememberMobileStructuredPiRuntime('pi_1', 'pi')
    expect(resolveMobileChatTabPiRuntime({ sessionId: 'pi_1' })).toBe('pi')
  })
})
