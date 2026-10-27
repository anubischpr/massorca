import { defineMethod } from '../core'
import {
  ApplyAccountGitConfig,
  BindableAccounts,
  ReadAccountGitConfig,
  ValidateAccountBinding
} from '../../../../shared/rpc-contract/github-account-binding-params'

export const GITHUB_ACCOUNT_BINDING_METHODS = [
  defineMethod({
    name: 'github.listBindableAccounts',
    permission: 'workspace',
    params: BindableAccounts,
    handler: async (params, { runtime }) =>
      runtime.listGitHubBindableAccounts(params.repo, {
        refreshCapability: params.refreshCapability
      })
  }),
  defineMethod({
    name: 'github.validateAccountBinding',
    permission: 'workspace',
    params: ValidateAccountBinding,
    handler: async (params, { runtime }) =>
      runtime.validateGitHubAccountBinding(params.repo, {
        host: params.host,
        user: params.user
      })
  }),
  defineMethod({
    name: 'github.applyAccountGitConfig',
    permission: 'workspace',
    params: ApplyAccountGitConfig,
    handler: async (params, { runtime }) =>
      runtime.applyGitHubAccountGitConfig(params.repo, {
        next: params.next,
        previous: params.previous,
        setIdentity: params.setIdentity === true
      })
  }),
  defineMethod({
    name: 'github.readAccountGitConfig',
    permission: 'workspace',
    params: ReadAccountGitConfig,
    handler: async (params, { runtime }) => runtime.readGitHubAccountGitConfig(params.repo)
  })
]
