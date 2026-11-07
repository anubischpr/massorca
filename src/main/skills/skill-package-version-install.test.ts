import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE } from '../../shared/skill-install-capability'
import type { SkillInstallProgress } from '../../shared/skill-sharing-contract'
import { SkillRemoteInstallCancellation } from './skill-remote-install-cancellation'

const { classifyTargetMock, installGrantMock, supportsInstallMock } = vi.hoisted(() => ({
  classifyTargetMock: vi.fn(),
  installGrantMock: vi.fn(),
  supportsInstallMock: vi.fn()
}))

vi.mock('./skill-cloud-install-target', () => ({
  classifySkillCloudInstallTarget: classifyTargetMock
}))
vi.mock('./skill-runtime-capability', () => ({
  supportsSkillRuntimeInstall: supportsInstallMock
}))
vi.mock('./skill-cloud-grant-installation', () => ({
  installSkillCloudGrant: installGrantMock
}))

import { installSkillPackageVersion } from './skill-package-version-install'

const DESTINATION = { scope: 'global' as const }
const PACKAGE_ID = 'package-1'
const VERSION_ID = 'version-reviewed'

function downloadGrant(versionId: string) {
  return {
    version: { packageId: PACKAGE_ID, versionId, name: 'writing-helper' },
    grant: { url: 'https://downloads.example.test/grant', expiresAt: '2030-01-01T00:00:00.000Z' }
  }
}

function runtimeMintingGrant(result: unknown) {
  return {
    createSkillPackageVersionDownloadGrant: vi.fn(async () => result),
    skillInstallDestinationUsesSsh: vi.fn(async () => false)
  }
}

describe('installSkillPackageVersion', () => {
  beforeEach(() => {
    classifyTargetMock.mockReset().mockResolvedValue('local')
    installGrantMock.mockReset().mockResolvedValue({ status: 'ok', value: { name: 'installed' } })
    supportsInstallMock.mockReset().mockResolvedValue(true)
  })

  it('answers unsupported without minting a grant when the runtime environment predates install', async () => {
    supportsInstallMock.mockResolvedValue(false)
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })

    const result = await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      {
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        environmentId: 'runtime:old',
        destination: DESTINATION
      },
      new SkillRemoteInstallCancellation()
    )

    expect(result).toEqual({
      status: 'unsupported',
      message: SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE
    })
    expect(supportsInstallMock).toHaveBeenCalledWith('/user-data', 'runtime:old')
    expect(runtime.createSkillPackageVersionDownloadGrant).not.toHaveBeenCalled()
    expect(installGrantMock).not.toHaveBeenCalled()
  })

  it('mints the grant for the requested version and reports authorizing then installing', async () => {
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })
    const phases: SkillInstallProgress[] = []

    const result = await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      { packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION },
      new SkillRemoteInstallCancellation(),
      (progress) => phases.push(progress)
    )

    const operationId = phases[0]?.operationId
    expect(operationId).toEqual(expect.any(String))
    expect(runtime.createSkillPackageVersionDownloadGrant).toHaveBeenCalledWith(
      PACKAGE_ID,
      VERSION_ID,
      { installTarget: 'local' }
    )
    expect(phases.map((progress) => progress.phase)).toEqual(['authorizing', 'installing'])
    expect(phases.map((progress) => progress.operationId)).toEqual([operationId, operationId])
    expect(installGrantMock).toHaveBeenCalledWith(
      runtime,
      downloadGrant(VERSION_ID),
      expect.objectContaining({ operationId, destination: DESTINATION })
    )
    expect(result).toEqual({ status: 'ok', value: { name: 'installed' } })
  })

  it('keeps an operation id the caller supplies', async () => {
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })
    const phases: SkillInstallProgress[] = []

    await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      {
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        operationId: 'operation-1',
        destination: DESTINATION
      },
      new SkillRemoteInstallCancellation(),
      (progress) => phases.push(progress)
    )

    expect(phases.map((progress) => progress.operationId)).toEqual(['operation-1', 'operation-1'])
    expect(installGrantMock).toHaveBeenCalledWith(
      runtime,
      downloadGrant(VERSION_ID),
      expect.objectContaining({ operationId: 'operation-1' })
    )
  })

  it('rejects a grant for a different version before installation', async () => {
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant('version-latest') })

    await expect(
      installSkillPackageVersion(
        runtime as never,
        '/user-data',
        { packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION },
        new SkillRemoteInstallCancellation()
      )
    ).rejects.toThrow('skill-package-version-mismatch')
    expect(installGrantMock).not.toHaveBeenCalled()
  })

  it('returns a non-ok grant result unchanged without installing', async () => {
    const unconfigured = { status: 'unconfigured', message: 'not configured' }
    const runtime = runtimeMintingGrant(unconfigured)

    const result = await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      { packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION },
      new SkillRemoteInstallCancellation()
    )

    expect(result).toEqual(unconfigured)
    expect(installGrantMock).not.toHaveBeenCalled()
  })

  it('installs a runtime-environment grant under an operation the cancellation can abort', async () => {
    classifyTargetMock.mockResolvedValue('remote')
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })
    const cancellation = new SkillRemoteInstallCancellation()
    let abortedDuringInstall = false
    let operationId = ''
    installGrantMock.mockImplementation(async (_runtime, _grant, input, signal: AbortSignal) => {
      operationId = input.operationId
      abortedDuringInstall = cancellation.cancel(operationId) && signal.aborted
      return { status: 'ok', value: { name: 'installed' } }
    })

    await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      {
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        environmentId: 'runtime:ready',
        destination: DESTINATION
      },
      cancellation
    )

    expect(supportsInstallMock).toHaveBeenCalledWith('/user-data', 'runtime:ready')
    expect(abortedDuringInstall).toBe(true)
    expect(cancellation.cancel(operationId)).toBe(false)
  })

  it('keeps SSH installs outside the cancellation registry', async () => {
    classifyTargetMock.mockResolvedValue('remote')
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })

    await installSkillPackageVersion(
      runtime as never,
      '/user-data',
      {
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        environmentId: 'ssh:host-1',
        destination: DESTINATION
      },
      new SkillRemoteInstallCancellation()
    )

    expect(installGrantMock.mock.calls[0]).toHaveLength(3)
  })
})
