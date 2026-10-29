import { describe, expect, it } from 'vitest'
import { PrototypeListedDirectionSchema } from './prototype-params'

const version = { version: 1, fileName: 'prototypes/20261028-201500-k3f9q2/A.html', mtime: 1 }

describe('PrototypeListedDirectionSchema', () => {
  it('takes a direction letter from A to Z only', () => {
    expect(
      PrototypeListedDirectionSchema.safeParse({ letter: 'Z', versions: [version] }).success
    ).toBe(true)
    for (const letter of ['a', '1', '#', '', 'AB']) {
      expect(
        PrototypeListedDirectionSchema.safeParse({ letter, versions: [version] }).success
      ).toBe(false)
    }
  })
})
