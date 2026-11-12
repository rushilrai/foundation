// A small RFC 4180 CSV reader: comma-separated, fields optionally wrapped
// in double quotes, `""` for a quote inside one, and line breaks (LF, CRLF
// or CR) allowed inside quoted fields. A leading BOM is dropped, and so are
// blank lines, including the usual trailing newline.
export const parseCsv = (input: string): string[][] => {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    // A blank line reads as one empty field; it is not a row.
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  while (i < text.length) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      } else {
        field += char
      }
      i += 1
      continue
    }

    if (char === '"' && field === '') {
      quoted = true
    } else if (char === ',') {
      endField()
    } else if (char === '\n' || char === '\r') {
      endRow()
      if (char === '\r' && text[i + 1] === '\n') i += 1
    } else {
      // A stray quote inside an unquoted field is kept as text.
      field += char
    }
    i += 1
  }

  if (field !== '' || row.length > 0) endRow()

  return rows
}
