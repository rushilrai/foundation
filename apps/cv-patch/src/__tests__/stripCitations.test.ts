import {
  deepStripCitations,
  stripCitationMarkers,
} from '@shared/stripCitations'
import { describe, expect, it } from 'vitest'

const S = String.fromCharCode(0xe200)
const E = String.fromCharCode(0xe201)
const SEP = String.fromCharCode(0xe202)

describe('stripCitationMarkers', () => {
  it('removes delimited citation blocks', () => {
    const text = `keeping the resume to one page. ${S}cite${SEP}turn0search13${SEP}turn0search16${E}`
    expect(stripCitationMarkers(text)).toBe('keeping the resume to one page.')
  })

  it('removes unterminated blocks at end of streamed text', () => {
    const text = `done. ${S}cite${SEP}turn0search1`
    expect(stripCitationMarkers(text)).toBe('done.')
  })

  it('removes bare tokens when delimiters were already lost', () => {
    expect(
      stripCitationMarkers('one page. citeturn0search13turn0search16'),
    ).toBe('one page.')
  })

  it('leaves normal prose untouched', () => {
    const prose = 'Cut latency 40% — turnaround was fast.'
    expect(stripCitationMarkers(prose)).toBe(prose)
  })
})

describe('deepStripCitations', () => {
  it('strips every string in a nested structure', () => {
    const input = {
      greeting: `Dear team,${S}cite${SEP}turn0search2${E}`,
      paragraphs: [`I shipped X. citeturn0search5`],
      count: 3,
    }
    expect(deepStripCitations(input)).toEqual({
      greeting: 'Dear team,',
      paragraphs: ['I shipped X.'],
      count: 3,
    })
  })
})
