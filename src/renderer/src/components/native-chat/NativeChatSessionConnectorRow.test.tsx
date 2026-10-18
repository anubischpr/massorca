// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { connectorIconKey, NativeChatSessionConnectorRow } from './NativeChatSessionConnectorRow'

afterEach(cleanup)

describe('NativeChatSessionConnectorRow', () => {
  it('humanizes the server name, keeps the raw key on hover, and states the status', () => {
    render(
      <NativeChatSessionConnectorRow
        connector={{ name: 'openmetadata-escritura', status: 'connected' }}
      />
    )
    expect(screen.getByText('Openmetadata escritura · Connected')).toBeTruthy()
    expect(screen.getByTitle('openmetadata-escritura')).toBeTruthy()
  })

  it('uses a known icon for well-known servers and the generic plug for any other', () => {
    expect(connectorIconKey('codegraph')).toBe('codegraph')
    expect(connectorIconKey('Context7-docs')).toBe('context7')
    expect(connectorIconKey('internal-tool')).toBe('plug')
  })
})
