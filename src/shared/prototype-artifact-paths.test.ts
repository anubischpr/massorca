import { describe, expect, it } from 'vitest'
import { isPrototypeArtifactPath } from './prototype-artifact-paths'

const CHAT_FOLDER = '0123456789abcdef0123456789abcdef'
const REQUEST = '20261028-201500-aaaaaa'

describe('isPrototypeArtifactPath', () => {
  it('is true for a prototype file relative to the visuals folder, with either separator', () => {
    expect(isPrototypeArtifactPath(`prototypes/${REQUEST}/A.html`)).toBe(true)
    expect(isPrototypeArtifactPath(`prototypes\\${REQUEST}\\B-v2.html`)).toBe(true)
  })

  it('is true for the absolute path of a prototype file inside a chat visuals folder', () => {
    expect(
      isPrototypeArtifactPath(
        `C:\\Users\\me\\AppData\\native-chat-visuals\\${CHAT_FOLDER}\\prototypes\\${REQUEST}\\A.html`
      )
    ).toBe(true)
    expect(
      isPrototypeArtifactPath(
        `/state/native-chat-visuals/${CHAT_FOLDER}/prototypes/${REQUEST}/A.html`
      )
    ).toBe(true)
  })

  it('is false for a chat visual, a report, or a path that only mentions prototypes', () => {
    expect(isPrototypeArtifactPath(`native-chat-visuals/${CHAT_FOLDER}/chart.html`)).toBe(false)
    expect(isPrototypeArtifactPath('C:\\repo\\report.html')).toBe(false)
    expect(isPrototypeArtifactPath('docs/prototypes-notes.md')).toBe(false)
    expect(isPrototypeArtifactPath('src/prototypes/index.ts')).toBe(false)
    expect(isPrototypeArtifactPath('')).toBe(false)
  })

  it('is false when the chat folder is not a 32-character digest', () => {
    expect(
      isPrototypeArtifactPath(`native-chat-visuals/notachatfolder/prototypes/${REQUEST}/A.html`)
    ).toBe(false)
  })

  it('is false for a request folder named with a traversal segment', () => {
    expect(isPrototypeArtifactPath('prototypes/../secret.html')).toBe(false)
  })
})
