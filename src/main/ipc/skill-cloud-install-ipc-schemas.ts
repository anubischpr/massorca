import { z } from 'zod'
import { SkillBundleInstallRequestSchema } from '../../shared/skill-bundle-install-contract'
import { SkillInstallDestinationSchema } from '../../shared/skill-install-contract'
import {
  installDestinationFields,
  skillCloudInstallEnvironmentIdSchema,
  skillCloudInstallProvidersSchema,
  SkillPackageVersionInstallParams
} from '../../shared/rpc-contract/skill-package-install-params'

export { skillCloudInstallEnvironmentIdSchema }
// Why: the package-version params are defined once in the RPC contract; the IPC keeps its old name.
export { SkillPackageVersionInstallParams as skillCloudPackageVersionInstallSchema }

export const skillCloudShareInstallSchema = z
  .object({
    shareId: z.string().min(1).max(128),
    versionId: z.string().min(1).max(128),
    ...installDestinationFields
  })
  .strict()

export const skillCloudBundleShareInstallSchema = z
  .object({
    shareId: z.string().min(1).max(128),
    versionId: z.string().min(1).max(128),
    operationId: z.string().min(1).max(128).optional(),
    environmentId: skillCloudInstallEnvironmentIdSchema.optional(),
    selectedSkillIds: SkillBundleInstallRequestSchema.shape.selectedSkillIds,
    destination: SkillInstallDestinationSchema,
    providers: skillCloudInstallProvidersSchema.optional(),
    conflictDecisions: SkillBundleInstallRequestSchema.shape.conflictDecisions.optional()
  })
  .strict()

export const skillCloudBundlePackageVersionInstallSchema = z
  .object({
    packageId: z.string().min(1).max(128),
    versionId: z.string().min(1).max(128),
    operationId: z.string().min(1).max(128).optional(),
    environmentId: skillCloudInstallEnvironmentIdSchema.optional(),
    selectedSkillIds: SkillBundleInstallRequestSchema.shape.selectedSkillIds,
    destination: SkillInstallDestinationSchema,
    providers: skillCloudInstallProvidersSchema.optional(),
    conflictDecisions: SkillBundleInstallRequestSchema.shape.conflictDecisions.optional()
  })
  .strict()
