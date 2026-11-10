import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '@/modules/common/errorMessages'

describe('getErrorMessage', () => {
  it('maps known error codes to user-facing text', () => {
    expect(getErrorMessage('RATE_LIMITED')).toMatch(/too many variants/)
    expect(getErrorMessage('SKILL_LINK_TEXT_MISSING')).toMatch(
      /skill link text must appear/,
    )
  })

  it('falls back for unknown codes', () => {
    expect(getErrorMessage('SOMETHING_NEW')).toBe(
      'Something went wrong. Please try again.',
    )
    expect(getErrorMessage('SOMETHING_NEW', 'Failed to save.')).toBe(
      'Failed to save.',
    )
  })
})
