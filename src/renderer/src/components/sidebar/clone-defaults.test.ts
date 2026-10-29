import { describe, expect, it } from 'vitest'
import {
  getCloneDestinationAutoFill,
  getDefaultCloneParent,
  getRemoteCloneParent,
  getClonePreviewPath,
  describeCloneFailure
} from './clone-defaults'

describe('getDefaultCloneParent', () => {
  it('strips a POSIX workspaces suffix', () => {
    expect(getDefaultCloneParent('/Users/mvanhorn/orca/workspaces')).toBe('/Users/mvanhorn/orca')
  })

  it('strips a POSIX workspaces suffix with a trailing slash', () => {
    expect(getDefaultCloneParent('/Users/mvanhorn/orca/workspaces/')).toBe('/Users/mvanhorn/orca')
  })

  it('strips a Windows workspaces suffix', () => {
    expect(getDefaultCloneParent('C:\\Users\\mvanhorn\\orca\\workspaces')).toBe(
      'C:\\Users\\mvanhorn\\orca'
    )
  })

  it('leaves input without a workspaces suffix unchanged', () => {
    expect(getDefaultCloneParent('/Users/mvanhorn/projects')).toBe('/Users/mvanhorn/projects')
  })

  it('returns empty input unchanged', () => {
    expect(getDefaultCloneParent('')).toBe('')
  })

  it('returns an empty parent for workspaces alone', () => {
    expect(getDefaultCloneParent('workspaces')).toBe('')
  })

  it('returns root for an absolute root workspaces path', () => {
    expect(getDefaultCloneParent('/workspaces')).toBe('/')
  })

  it('returns the drive root for a Windows root workspaces path', () => {
    expect(getDefaultCloneParent('C:\\workspaces')).toBe('C:\\')
  })

  it('strips repeated trailing separators before matching the suffix', () => {
    expect(getDefaultCloneParent('D:\\orca\\workspaces\\\\')).toBe('D:\\orca')
  })

  it('does not strip a similar-looking final segment', () => {
    expect(getDefaultCloneParent('/Users/mvanhorn/orca/project-workspaces')).toBe(
      '/Users/mvanhorn/orca/project-workspaces'
    )
  })
})

describe('getCloneDestinationAutoFill', () => {
  it('fills the local clone destination from the workspace directory', () => {
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '',
        activeRuntimeEnvironmentId: null,
        workspaceDir: '/Users/mvanhorn/orca/workspaces',
        cloneStepAutoFilled: false
      })
    ).toEqual({ destination: '/Users/mvanhorn/orca' })
  })

  it('waits for a workspace directory before filling', () => {
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '',
        activeRuntimeEnvironmentId: null,
        workspaceDir: null,
        cloneStepAutoFilled: false
      })
    ).toBeNull()
  })

  it('does not overwrite typed destinations or repeat an auto-fill', () => {
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '/tmp/project',
        activeRuntimeEnvironmentId: null,
        workspaceDir: '/Users/mvanhorn/orca/workspaces',
        cloneStepAutoFilled: false
      })
    ).toBeNull()
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '',
        activeRuntimeEnvironmentId: null,
        workspaceDir: '/Users/mvanhorn/orca/workspaces',
        cloneStepAutoFilled: true
      })
    ).toBeNull()
  })

  it('does not fill server clone destinations for runtime environments', () => {
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '',
        activeRuntimeEnvironmentId: 'env-local-linux',
        workspaceDir: '/Users/mvanhorn/orca/workspaces',
        cloneStepAutoFilled: false
      })
    ).toBeNull()
  })

  it('does not fill SSH clone destinations from the local workspace directory', () => {
    expect(
      getCloneDestinationAutoFill({
        step: 'clone',
        cloneDestination: '',
        activeRuntimeEnvironmentId: null,
        sshTargetId: 'openclaw-2',
        workspaceDir: '/Users/mvanhorn/orca/workspaces',
        cloneStepAutoFilled: false
      })
    ).toBeNull()
  })
})

describe('getRemoteCloneParent', () => {
  it('uses <remote home>/projects when the host has no configured location', () => {
    expect(getRemoteCloneParent({ home: '/home/christian' })).toBe('/home/christian/projects')
    expect(getRemoteCloneParent({ home: '/home/christian/' })).toBe('/home/christian/projects')
    expect(getRemoteCloneParent({ home: '' })).toBe('')
  })

  it('prefers the configured host location, mapping a workspaces folder to its parent', () => {
    expect(getRemoteCloneParent({ configuredLocation: '/srv/code' })).toBe('/srv/code')
    expect(getRemoteCloneParent({ configuredLocation: '/home/c/orca/workspaces' })).toBe(
      '/home/c/orca'
    )
  })
})

describe('getClonePreviewPath', () => {
  it.each([
    ['https://github.com/Alterra-DS/mf-app', '/home/christian/projects/mf-app'],
    ['https://github.com/Alterra-DS/mf-app.git', '/home/christian/projects/mf-app'],
    ['git@github.com:Alterra-DS/mf-app.git', '/home/christian/projects/mf-app'],
    ['git@github.com-anubischpr:Alterra-DS/mf-app.git', '/home/christian/projects/mf-app']
  ])('joins the repo name from %s', (url, expected) => {
    expect(getClonePreviewPath(url, '/home/christian/projects')).toBe(expected)
  })

  it('uses the Windows separator for a Windows parent', () => {
    expect(getClonePreviewPath('https://github.com/o/r.git', 'C:\\Users\\me\\projects')).toBe(
      'C:\\Users\\me\\projects\\r'
    )
  })

  it('is null until both parts are usable', () => {
    expect(getClonePreviewPath('', '/p')).toBeNull()
    expect(getClonePreviewPath('https://github.com/o/r', ' ')).toBeNull()
    expect(getClonePreviewPath('https://github.com/o/..', '/p')).toBeNull()
  })
})

describe('describeCloneFailure', () => {
  it('names the existing target folder', () => {
    expect(
      describeCloneFailure(
        "fatal: destination path 'mf-app' already exists and is not an empty directory.",
        'https://github.com/Alterra-DS/mf-app',
        '/home/christian/projects'
      )
    ).toContain('/home/christian/projects/mf-app already exists')
  })

  it('passes other failures through', () => {
    expect(describeCloneFailure('auth failed', 'https://github.com/o/r', '/p')).toBe('auth failed')
  })
})
