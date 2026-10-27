import { describe, expect, it } from 'vitest'
import {
  buildRuntimeWorktreeCreateParams,
  type WorktreeCreateRequest
} from './worktree-create-payload'

const attempt = { name: 'chat' }

describe('buildRuntimeWorktreeCreateParams setupPresentation', () => {
  it('sends the chat-first setup presentation to the runtime', () => {
    const request: WorktreeCreateRequest = {
      repoId: 'repo-1',
      name: 'chat',
      options: { setupPresentation: 'chat-background-task' }
    }
    expect(buildRuntimeWorktreeCreateParams(request, attempt)).toMatchObject({
      setupPresentation: 'chat-background-task'
    })
  })

  it('omits the presentation when the create did not ask for one', () => {
    const request: WorktreeCreateRequest = { repoId: 'repo-1', name: 'feature' }
    expect(buildRuntimeWorktreeCreateParams(request, attempt)).not.toHaveProperty(
      'setupPresentation'
    )
  })
})
