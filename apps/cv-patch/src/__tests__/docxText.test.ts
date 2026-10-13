import { describe, expect, it } from 'vitest'

import {
  extractPlainText,
  parseHyperlinkTargets,
} from '../../convex/modules/resume/docxText'

const HYPERLINK_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink'

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId7" Type="${HYPERLINK_TYPE}" Target="mailto:jane.doe@example.com" TargetMode="External"/>
  <Relationship Id="rId8" Type="${HYPERLINK_TYPE}" Target="https://www.linkedin.com/in/janedoe/" TargetMode="External"/>
  <Relationship Id="rId9" Type="${HYPERLINK_TYPE}" Target="https://example.com/?a=1&amp;b=2" TargetMode="External"/>
</Relationships>`

const run = (text: string) =>
  `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  <w:p>${run('Jane Doe')}</w:p>
  <w:p>
    ${run('+1 555 010 1234    ')}
    <w:hyperlink r:id="rId7" w:history="1">${run('jane.doe@example.com')}</w:hyperlink>
    ${run('    ')}
    <w:hyperlink r:id="rId8" w:history="1">${run('Linked')}${run('In')}</w:hyperlink>
    ${run('    ')}
    <w:hyperlink r:id="rId9">${run('Site')}</w:hyperlink>
    ${run('    ')}
    <w:hyperlink w:anchor="_top">${run('Top')}</w:hyperlink>
    ${run('    London')}
  </w:p>
  <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${run('Cut release time by 30% &amp; costs')}</w:p>
  <w:p>${run('Acme Ltd')}<w:r><w:tab/></w:r>${run('2021 - Present')}</w:p>
  <w:p></w:p>
</w:body>
</w:document>`

describe('parseHyperlinkTargets', () => {
  it('maps hyperlink relationship ids to decoded targets only', () => {
    const targets = parseHyperlinkTargets(RELS_XML)

    expect(Object.fromEntries(targets)).toEqual({
      rId7: 'mailto:jane.doe@example.com',
      rId8: 'https://www.linkedin.com/in/janedoe/',
      rId9: 'https://example.com/?a=1&b=2',
    })
  })

  it('returns an empty map for empty rels', () => {
    expect(parseHyperlinkTargets('').size).toBe(0)
  })
})

describe('extractPlainText', () => {
  const lines = extractPlainText(
    DOCUMENT_XML,
    parseHyperlinkTargets(RELS_XML),
  ).split('\n')

  it('inlines hyperlink targets after the link text on the contact line', () => {
    expect(lines[1]).toBe(
      '+1 555 010 1234 jane.doe@example.com (mailto:jane.doe@example.com) LinkedIn (https://www.linkedin.com/in/janedoe/) Site (https://example.com/?a=1&b=2) Top London',
    )
  })

  it('keeps one line per non-empty paragraph and prefixes bullets', () => {
    expect(lines).toEqual([
      'Jane Doe',
      expect.any(String),
      '• Cut release time by 30% & costs',
      'Acme Ltd 2021 - Present',
    ])
  })

  it('leaves link text bare without relationship targets', () => {
    const plain = extractPlainText(DOCUMENT_XML).split('\n')

    expect(plain[1]).toBe(
      '+1 555 010 1234 jane.doe@example.com LinkedIn Site Top London',
    )
  })
})
