import { randomUUID } from 'node:crypto'
import type { SkillCloudDownloadGrant } from '../../shared/skill-cloud-contract'
import { SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE } from '../../shared/skill-install-capability'
import type { SkillInstallProgress } from '../../shared/skill-sharing-contract'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import {
  installSkillCloudGrant,
  type SkillCloudGrantInstallInput
} from './skill-cloud-grant-installation'
import { assertSkillCloudGrantVersion } from './skill-cloud-grant-version'
import { classifySkillCloudInstallTarget } from './skill-cloud-install-target'
import type { SkillRemoteInstallCancellation } from './skill-remote-install-cancellation'
import { supportsSkillRuntimeInstall } from './skill-runtime-capability'

export type AuthorizedSkillCloudGrantInput = Omit<SkillCloudGrantInstallInput, 'operationId'> & {
  operationId?: string
}

export type SkillPackageVersionInstallRequest = AuthorizedSkillCloudGrantInput & {
  packageId: string
  versionId: string
}

// Why: only runtime-environment installs register a cancellable operation; local and SSH installs do not.
export async function installAuthorizedSkillCloudGrant(
  runtime: OrcaRuntimeService,
  cancellation: SkillRemoteInstallCancellation,
  grant: SkillCloudDownloadGrant,
  input: AuthorizedSkillCloudGrantInput
) {
  const operationId = input.operationId ?? randomUUID()
  if (!input.environmentId || input.environmentId.startsWith('ssh:')) {
    return installSkillCloudGrant(runtime, grant, { ...input, operationId })
  }
  const signal = cancellation.begin(operationId)
  try {
    return await installSkillCloudGrant(runtime, grant, { ...input, operationId }, signal)
  } finally {
    cancellation.finish(operationId, signal)
  }
}

export async function installSkillPackageVersion(
  runtime: OrcaRuntimeService,
  userDataPath: string,
  input: SkillPackageVersionInstallRequest,
  cancellation: SkillRemoteInstallCancellation,
  onProgress?: (progress: SkillInstallProgress) => void
) {
  const request = { ...input, operationId: input.operationId ?? randomUUID() }
  const { operationId } = request
  onProgress?.({ operationId, phase: 'authorizing' })
  if (
    request.environmentId &&
    !(await supportsSkillRuntimeInstall(userDataPath, request.environmentId))
  ) {
    return { status: 'unsupported' as const, message: SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE }
  }
  const installTarget = await classifySkillCloudInstallTarget(runtime, request)
  const grant = await runtime.createSkillPackageVersionDownloadGrant(
    request.packageId,
    request.versionId,
    { installTarget }
  )
  if (grant.status !== 'ok') {
    return grant
  }
  assertSkillCloudGrantVersion(grant.value, request.versionId)
  onProgress?.({ operationId, phase: 'installing' })
  return installAuthorizedSkillCloudGrant(runtime, cancellation, grant.value, request)
}
