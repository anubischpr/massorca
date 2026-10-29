import { describe, expect, it } from 'vitest'
import { classifyDelegationTask } from './delegation-task-classifier'

function classify(summary: string, writesCode = false) {
  return classifyDelegationTask({ summary, writesCode })
}

describe('classifyDelegationTask', () => {
  describe('risk', () => {
    it.each([
      'Review the security headers',
      'Audit auth token handling',
      'Change the permission model',
      'Wire the payment webhook',
      'Write the database migration',
      'Delete the stale cache',
      'Check the production config',
      'Rotate the credential store',
      'Assess the data loss exposure',
      'Cut a release'
    ])('marks "%s" high', (summary) => {
      expect(classify(summary).dimensions.risk).toBe('high')
    })

    it('matches keywords case-insensitively', () => {
      expect(classify('SECURITY audit').dimensions.risk).toBe('high')
    })

    it('marks code writes without a risk keyword medium and reads low', () => {
      expect(classify('Summarize the changelog', true).dimensions.risk).toBe('medium')
      expect(classify('Summarize the changelog').dimensions.risk).toBe('low')
    })
  })

  describe('complexity', () => {
    it('marks architecture-scale work high', () => {
      expect(classify('Refactor the session store').dimensions.complexity).toBe('high')
    })

    it('marks routine work low', () => {
      expect(classify('Fix the typo in the docs').dimensions.complexity).toBe('low')
    })

    it('keeps a substantive verb above a routine one', () => {
      expect(classify('Implement the lint rule').dimensions.complexity).toBe('medium')
    })

    it('lets a high keyword outrank a medium one', () => {
      expect(classify('Redesign the integration layer').dimensions.complexity).toBe('high')
    })

    it('defaults to medium', () => {
      expect(classify('Summarize the changelog').dimensions.complexity).toBe('medium')
    })
  })

  describe('verifiability', () => {
    it('marks checkable work high', () => {
      expect(classify('Add tests for the parser').dimensions.verifiability).toBe('high')
    })

    it('marks exploratory work low', () => {
      expect(classify('Explore the design options').dimensions.verifiability).toBe('low')
    })

    it('defaults to medium', () => {
      expect(classify('Summarize the changelog').dimensions.verifiability).toBe('medium')
    })

    it('matches keywords at a word start only', () => {
      expect(classify('Summarize the latest changelog').dimensions.verifiability).toBe('medium')
    })
  })

  describe('ambiguity', () => {
    it('marks open questions high', () => {
      expect(classify('Decide the cache strategy').dimensions.ambiguity).toBe('high')
    })

    it('marks precise requests low', () => {
      expect(classify('Rename the exact field').dimensions.ambiguity).toBe('low')
    })

    it('defaults to medium', () => {
      expect(classify('Summarize the changelog').dimensions.ambiguity).toBe('medium')
    })
  })

  describe('tier', () => {
    it.each([
      { summary: 'Rename the exact field and run the tests', writesCode: false, tier: 1 },
      { summary: 'Summarize the changelog', writesCode: false, tier: 2 },
      {
        summary: 'Explore the new tool and list its features to adopt, read-only',
        writesCode: false,
        tier: 3
      },
      {
        summary: 'Redesign the architecture, research options, decide the proposal',
        writesCode: true,
        tier: 4
      },
      {
        summary:
          'Redesign the architecture for security, research the design options, and decide the proposal',
        writesCode: false,
        tier: 5
      }
    ])('places "$summary" in tier $tier', ({ summary, writesCode, tier }) => {
      expect(classify(summary, writesCode).tier).toBe(tier)
    })

    it('raises a high-risk task to the tier-4 floor and reports it', () => {
      expect(classify('Delete the stale cache')).toMatchObject({ tier: 4, riskFloorApplied: true })
    })

    it('does not report the floor when the score already reaches tier 4', () => {
      expect(
        classify('Redesign the architecture, research options, decide the proposal', true)
      ).toMatchObject({ tier: 4, riskFloorApplied: false })
    })

    it('treats shipping a release as high risk but reading one as low', () => {
      expect(classify('Release to production').dimensions.risk).toBe('high')
      expect(classify('Explore a new tool release, read-only').dimensions.risk).toBe('low')
    })

    it.each(['', '   '])(
      'falls back to the medium defaults for a blank summary (%j)',
      (summary) => {
        expect(classify(summary)).toMatchObject({
          dimensions: {
            risk: 'low',
            complexity: 'medium',
            verifiability: 'medium',
            ambiguity: 'medium'
          },
          tier: 2,
          riskFloorApplied: false
        })
        expect(classify(summary, true).tier).toBe(3)
      }
    )

    it('places the approved prototype example in tier 3', () => {
      expect(
        classify('Explore a new tool release and list features to adopt, read-only').tier
      ).toBe(3)
    })

    it('does not read "author" as auth', () => {
      expect(classify('Summarize the author list').dimensions.risk).toBe('low')
      expect(classify('Review the authorization flow').dimensions.risk).toBe('high')
    })
  })
})
