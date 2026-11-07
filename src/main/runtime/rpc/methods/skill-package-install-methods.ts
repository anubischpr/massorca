import { getAppEnvironment } from '../../../../shared/app-environment'
import {
  SKILL_PACKAGE_VERSION_INSTALL_METHOD,
  SkillPackageVersionInstallParams
} from '../../../../shared/rpc-contract/skill-package-install-params'
import { installSkillPackageVersion } from '../../../skills/skill-package-version-install'
import { skillRemoteInstallCancellation } from '../../../skills/skill-remote-install-cancellation'
import { defineMethod } from '../core'

// Why: installs are minted with the desktop's Skill Cloud session; a headless host has none and fails in that service.
export const SKILL_PACKAGE_INSTALL_METHODS = [
  defineMethod({
    name: SKILL_PACKAGE_VERSION_INSTALL_METHOD,
    permission: 'skills-admin',
    params: SkillPackageVersionInstallParams,
    handler: (params, { runtime }) =>
      installSkillPackageVersion(
        runtime,
        getAppEnvironment().getPath('userData'),
        params,
        skillRemoteInstallCancellation
      )
  })
]
