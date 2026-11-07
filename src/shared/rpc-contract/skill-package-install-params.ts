import { z } from 'zod'
import { SkillInstallDestinationSchema } from '../skill-install-contract'

// Why: a new method name, so a host that predates it answers `method_not_found` and clients ask for an update.
export const SKILL_PACKAGE_VERSION_INSTALL_METHOD = 'skills.installPackageVersion'

export const skillCloudInstallEnvironmentIdSchema = z.string().min(1).max(128)

export const skillCloudInstallProvidersSchema = z.array(z.string().min(1).max(64)).max(64)

export const installDestinationFields = {
  operationId: z.string().min(1).max(128).optional(),
  environmentId: skillCloudInstallEnvironmentIdSchema.optional(),
  destination: SkillInstallDestinationSchema,
  providers: skillCloudInstallProvidersSchema.optional(),
  conflictResolution: z
    .enum(['replace-unmodified', 'replace-and-discard-local', 'cancel'])
    .optional()
} as const

export const SkillPackageVersionInstallParams = z
  .object({
    packageId: z.string().min(1).max(128),
    versionId: z.string().min(1).max(128),
    ...installDestinationFields
  })
  .strict()
