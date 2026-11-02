import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDiagnosticTokenEndpoint } from './diagnostic-upload-endpoint'

describe('resolveDiagnosticTokenEndpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('refuses the upstream endpoint injected by inherited release workflows', () => {
    vi.stubGlobal('ORCA_BUILD_IDENTITY', 'stable')
    vi.stubGlobal('ORCA_DIAGNOSTICS_TOKEN_URL', 'https://www.onorca.dev/diagnostics/token')

    expect(resolveDiagnosticTokenEndpoint()).toBeNull()
  })

  it('refuses the upstream endpoint from the environment', () => {
    vi.stubEnv('ORCA_DIAGNOSTICS_TOKEN_URL', 'https://onorca.dev/diagnostics/token')

    expect(resolveDiagnosticTokenEndpoint()).toBeNull()
  })

  it('keeps an endpoint on another host', () => {
    vi.stubEnv('ORCA_DIAGNOSTICS_TOKEN_URL', 'https://diagnostics.example.test/token')

    expect(resolveDiagnosticTokenEndpoint()).toBe('https://diagnostics.example.test/token')
  })

  it('does not treat a lookalike host as upstream', () => {
    vi.stubEnv('ORCA_DIAGNOSTICS_TOKEN_URL', 'https://notonorca.dev/token')

    expect(resolveDiagnosticTokenEndpoint()).toBe('https://notonorca.dev/token')
  })
})
