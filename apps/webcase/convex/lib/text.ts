// Collapses whitespace, trims and caps the length with an ellipsis.
// Undefined when nothing is left. The one text cleaner for stored and
// parsed values.
export const capText = (
  value: string | undefined,
  max: number,
): string | undefined => {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text) {
    return undefined
  }

  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}
