import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setAppEnvironment, type AppEnvironment } from '../../../../shared/app-environment'
import { SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE } from '../../../../shared/skill-install-capability'
import { skillRemoteInstallCancellation } from '../../../skills/skill-remote-install-cancellation'
import { eraseRpcMethods, type RpcContext } from '../core'
import type * as FlowModule from '../../../skills/skill-package-version-install'

const { classifyTargetMock, installFlowMock, installGrantMock, supportsInstallMock } = vi.hoisted(
  () => ({
    classifyTargetMock: vi.fn(),
    installFlowMock: vi.fn(),
    installGrantMock: vi.fn(),
    supportsInstallMock: vi.fn()
  })
)

vi.mock('../../../skills/skill-cloud-install-target', () => ({
  classifySkillCloudInstallTarget: classifyTargetMock
}))
vi.mock('../../../skills/skill-runtime-capability', () => ({
  supportsSkillRuntimeInstall: supportsInstallMock
}))
vi.mock('../../../skills/skill-cloud-grant-installation', () => ({
  installSkillCloudGrant: installGrantMock
}))
// Why: the real flow runs; the spy only records what the RPC hands it.
vi.mock('../../../skills/skill-package-version-install', async (importOriginal) => {
  const actual = await importOriginal<typeof FlowModule>()
  return {
    ...actual,
    installSkillPackageVersion: (...args: Parameters<typeof actual.installSkillPackageVersion>) => {
      installFlowMock(...args)
      return actual.installSkillPackageVersion(...args)
    }
  }
})

import { SKILL_PACKAGE_INSTALL_METHODS } from './skill-package-install-methods'

const PACKAGE_ID = 'package-1'
const VERSION_ID = 'version-reviewed'
const DESTINATION = { scope: 'global' as const }

function appEnvironment(): AppEnvironment {
  return {
    getPath: () => '/orca-state',
    getAppPath: () => '/orca-app',
    getVersion: () => '0.0.0-test',
    isPackaged: () => true,
    onWillQuit: () => {},
    exit: () => {},
    getAppMetrics: () => []
  }
}

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

function method() {
  const found = eraseRpcMethods(SKILL_PACKAGE_INSTALL_METHODS).find(
    (entry) => entry.name === 'skills.installPackageVersion'
  )
  if (!found) {
    throw new Error('skills.installPackageVersion method not registered')
  }
  return found
}

// Why: mirror the dispatcher, which parses params against the method schema before the handler runs.
async function invoke(runtime: ReturnType<typeof runtimeMintingGrant>, params: unknown) {
  const parsed = method().params?.parse(params)
  return method().handler(parsed, { runtime } as unknown as RpcContext)
}

describe('skills.installPackageVersion RPC', () => {
  beforeEach(() => {
    setAppEnvironment(appEnvironment())
    classifyTargetMock.mockReset().mockResolvedValue('local')
    installFlowMock.mockReset()
    installGrantMock.mockReset().mockResolvedValue({ status: 'ok', value: { name: 'installed' } })
    supportsInstallMock.mockReset().mockResolvedValue(true)
  })

  it('is registered under the skills-admin scope', () => {
    expect(method().name).toBe('skills.installPackageVersion')
    expect(method().permission).toBe('skills-admin')
  })

  it('rejects params the install contract does not allow', () => {
    const params = method().params
    expect(
      params?.safeParse({ packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION })
        .success
    ).toBe(true)
    expect(
      params?.safeParse({
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        destination: DESTINATION,
        unexpected: true
      }).success
    ).toBe(false)
    expect(
      params?.safeParse({ packageId: '', versionId: VERSION_ID, destination: DESTINATION }).success
    ).toBe(false)
    expect(params?.safeParse({ packageId: PACKAGE_ID, versionId: VERSION_ID }).success).toBe(false)
  })

  it('hands the parsed input to the shared flow with the shared cancellation registry', async () => {
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })

    await invoke(runtime, {
      packageId: PACKAGE_ID,
      versionId: VERSION_ID,
      destination: DESTINATION
    })

    expect(installFlowMock).toHaveBeenCalledWith(
      runtime,
      '/orca-state',
      { packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION },
      skillRemoteInstallCancellation
    )
  })

  it('returns the flow result as the install answer', async () => {
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })

    await expect(
      invoke(runtime, { packageId: PACKAGE_ID, versionId: VERSION_ID, destination: DESTINATION })
    ).resolves.toEqual({ status: 'ok', value: { name: 'installed' } })
  })

  it('answers unsupported when the runtime environment predates install', async () => {
    supportsInstallMock.mockResolvedValue(false)
    const runtime = runtimeMintingGrant({ status: 'ok', value: downloadGrant(VERSION_ID) })

    await expect(
      invoke(runtime, {
        packageId: PACKAGE_ID,
        versionId: VERSION_ID,
        environmentId: 'runtime:old',
        destination: DESTINATION
      })
    ).resolves.toEqual({ status: 'unsupported', message: SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE })
    expect(runtime.createSkillPackageVersionDownloadGrant).not.toHaveBeenCalled()
    expect(installGrantMock).not.toHaveBeenCalled()
  })
})
