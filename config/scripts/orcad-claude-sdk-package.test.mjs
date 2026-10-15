import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ORCAD_EXTERNAL_MODULES } from './orcad-entry-build.mjs'
import { stageOrcadClaudeSdk } from './orcad-claude-sdk-package.mjs'
import {
  ORCAD_CLAUDE_SDK_ARTIFACTS,
  orcadArtifactFilenames
} from '../../src/shared/orcad-artifacts.ts'

test('the packaged CJS server imports the original ESM SDK without starting a provider', async () => {
  const root = join(import.meta.dirname, '..', '..')
  const artifact = mkdtempSync(join(tmpdir(), 'orca-sdk-package-'))
  try {
    stageOrcadClaudeSdk(root, artifact)
    const outfile = join(artifact, 'sdk-loader.cjs')
    await build({
      stdin: {
        contents: 'exports.load = () => import("@anthropic-ai/claude-agent-sdk")',
        resolveDir: root
      },
      outfile,
      platform: 'node',
      format: 'cjs',
      bundle: true,
      external: ORCAD_EXTERNAL_MODULES,
      logLevel: 'silent'
    })
    const module = await import(pathToFileURL(outfile).href)
    const sdk = await module.default.load()
    assert.equal(typeof sdk.query, 'function')
    const declared = new Set(orcadArtifactFilenames('linux-x64'))
    for (const file of ORCAD_CLAUDE_SDK_ARTIFACTS) {
      assert.ok(existsSync(join(artifact, file)), file)
      assert.ok(declared.has(file), file)
    }
    assert.equal(
      existsSync(join(artifact, 'node_modules/@anthropic-ai/claude-agent-sdk/node_modules')),
      false
    )
  } finally {
    rmSync(artifact, { recursive: true, force: true })
  }
})
