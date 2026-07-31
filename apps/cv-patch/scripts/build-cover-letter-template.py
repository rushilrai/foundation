#!/usr/bin/env python3
"""Builds convex/assets/cover-letter-template.docx from scratch.

The template is a minimal single-page letter using docxtemplater tags:
  {senderName} {contactLine} {date} {company} {greeting}
  {#paragraphs}{.}{/paragraphs}

Run: python3 scripts/build-cover-letter-template.py
Then: bun encode:template
"""

import zipfile
from pathlib import Path

OUT_PATH = Path(__file__).resolve().parent.parent / 'convex' / 'assets' / 'cover-letter-template.docx'

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"""

DOCUMENT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>"""

STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>"""


def para(text, bold=False, size=None, space_after=None, center=False):
    rpr = ''
    if bold or size:
        rpr = '<w:rPr>'
        if bold:
            rpr += '<w:b/><w:bCs/>'
        if size:
            rpr += f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>'
        rpr += '</w:rPr>'

    ppr_parts = []
    if space_after is not None:
        ppr_parts.append(f'<w:spacing w:after="{space_after}"/>')
    if center:
        ppr_parts.append('<w:jc w:val="center"/>')
    ppr = f'<w:pPr>{"".join(ppr_parts)}</w:pPr>' if ppr_parts else ''

    return f'<w:p>{ppr}<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r></w:p>'


def main():
    body = ''.join(
        [
            para('{senderName}', bold=True, size=28, space_after=40, center=True),
            para('{contactLine}', size=18, space_after=240, center=True),
            para('{date}', space_after=40),
            para('{company}', space_after=240),
            para('{greeting}', space_after=160),
            para('{#paragraphs}', space_after=0),
            para('{.}', space_after=160),
            para('{/paragraphs}', space_after=0),
            para('Sincerely,', space_after=40),
            para('{senderName}', space_after=0),
        ]
    )

    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{body}'
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>'
        '</w:sectPr></w:body></w:document>'
    )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(OUT_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/_rels/document.xml.rels', DOCUMENT_RELS)
        z.writestr('word/styles.xml', STYLES)
        z.writestr('word/document.xml', document)

    print(f'Wrote cover letter template to {OUT_PATH}')


if __name__ == '__main__':
    main()
