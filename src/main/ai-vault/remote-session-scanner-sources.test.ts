import { describe, expect, it } from 'vitest'
import { getRemoteHostPlatform, type RemoteHostPlatform } from '../ssh/ssh-remote-platform'
import type { RelayPlatform } from '../ssh/relay-protocol'
import { remoteSessionSources } from './remote-session-scanner-sources'

function devinRootDirs(relayPlatform: RelayPlatform, remoteHome: string): string[] {
  const hostPlatform: RemoteHostPlatform = getRemoteHostPlatform(relayPlatform)
  return remoteSessionSources(remoteHome, hostPlatform)
    .filter((source) => source.agent === 'devin')
    .map((source) => source.rootDir)
}

describe('remoteSessionSources devin transcripts root', () => {
  it.each([
    {
      relayPlatform: 'win32-x64' as const,
      remoteHome: 'C:/Users/dev',
      expected: 'C:/Users/dev/AppData/Roaming/devin/cli/transcripts'
    },
    {
      relayPlatform: 'linux-x64' as const,
      remoteHome: '/home/dev',
      expected: '/home/dev/.local/share/devin/cli/transcripts'
    },
    {
      relayPlatform: 'darwin-arm64' as const,
      remoteHome: '/Users/dev',
      expected: '/Users/dev/.local/share/devin/cli/transcripts'
    }
  ])('resolves $expected on $relayPlatform', ({ relayPlatform, remoteHome, expected }) => {
    expect(devinRootDirs(relayPlatform, remoteHome)).toEqual([
      expected,
      expected.replace(/transcripts$/, 'agent_logs')
    ])
  })
})

describe('remoteSessionSources Gentle Shell sessions root', () => {
  it('scans the Gentle Shell store as a second pi root on a POSIX remote', () => {
    const hostPlatform = getRemoteHostPlatform('linux-x64')
    const piRoots = remoteSessionSources('/home/dev', hostPlatform)
      .filter((source) => source.agent === 'pi')
      .map((source) => source.rootDir)
    expect(piRoots.some((root) => root.endsWith('/.gentle-shell/agent/sessions'))).toBe(true)
    expect(piRoots.some((root) => root.endsWith('/.pi/agent/sessions'))).toBe(true)
  })
})
