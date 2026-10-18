// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { sayAgentSessionFailureEnglish } from '../../../../shared/agent-session-failure-copy'
import { agentSessionFailureSentence } from '../../../../shared/agent-session-failure-words'
import { agentSessionRefusalFailure } from '../../../../shared/agent-session-write-failure'
import { NativeChatComposerNotices } from './NativeChatComposerNotices'
import { structuredSessionNotices } from './native-chat-structured-session-notices'

afterEach(cleanup)

it('names the Command setting when it is not a program Orca can run', () => {
  const failure = agentSessionRefusalFailure({
    code: 'agent_session_operation_invalid',
    details: { reason: 'agentCommandNotRunnable' }
  })
  render(
    <NativeChatComposerNotices
      notices={structuredSessionNotices({
        launch: { lifecycle: 'failed', failure, retry: () => {} },
        agentLabel: 'Claude',
        sessionError: null,
        composerError: null
      })}
    />
  )
  expect(
    screen.getByText(
      "Chat could not be started. Claude's Command in Settings → Agents must be a program path or name Orca can find, with no arguments or variables. Change it or reset it."
    )
  ).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
})

it('reads naturally where no agent name is known', () => {
  expect(
    agentSessionFailureSentence(
      { kind: 'agentCommandNotRunnable' },
      'row',
      {},
      sayAgentSessionFailureEnglish
    )
  ).toBe(
    "The agent's Command in Settings → Agents must be a program path or name Orca can find, with no arguments or variables. Change it or reset it."
  )
})

it('shows the safe typed Windows Antigravity cause through the launch notice', () => {
  const failure = agentSessionRefusalFailure({
    code: 'structured_agent_session_unsupported',
    details: { reason: 'antigravityWindowsUnsupported' }
  })
  render(
    <NativeChatComposerNotices
      notices={structuredSessionNotices({
        launch: { lifecycle: 'failed', failure, retry: () => {} },
        agentLabel: 'Antigravity',
        sessionError: null,
        composerError: null
      })}
    />
  )
  expect(
    screen.getByText(
      'Chat could not be started. Antigravity chat cannot verify Windows credential storage. Run Antigravity in a terminal on this PC.'
    )
  ).toBeTruthy()
})

it('shows the typed Antigravity credential-storage cause of a refused create', () => {
  const failure = agentSessionRefusalFailure({
    code: 'structured_agent_session_unsupported',
    details: { reason: 'managedAccountUnsupported' }
  })
  render(
    <NativeChatComposerNotices
      notices={structuredSessionNotices({
        launch: { lifecycle: 'failed', failure, retry: () => {} },
        agentLabel: 'Antigravity',
        sessionError: null,
        composerError: null
      })}
    />
  )
  expect(
    screen.getByText(
      "Chat could not be started. Orca could not verify Antigravity's credential storage on this computer. Check Antigravity in a terminal there, then try again."
    )
  ).toBeTruthy()
})
