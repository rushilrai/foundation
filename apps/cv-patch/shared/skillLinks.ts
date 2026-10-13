import type { ResumeData, ResumeSkillLine } from './resumeSchema'

export type SkillLinkRange = { start: number; end: number }

// Where each link of a skill line sits inside its value, in link order: the
// first occurrence of the link text not overlapping an earlier link. N links
// with the same text therefore need N separate occurrences. null = the text
// is empty or has no free occurrence left (the renderer cannot link it).
// The DOCX renderer and every validator use this, so they always agree.
export function locateSkillLinks(
  value: string,
  links: ResumeSkillLine['links'],
): Array<SkillLinkRange | null> {
  const placed: Array<SkillLinkRange> = []

  return links.map(({ text }) => {
    if (!text) {
      return null
    }

    let start = value.indexOf(text)
    while (
      start !== -1 &&
      placed.some(
        (range) => start < range.end && start + text.length > range.start,
      )
    ) {
      start = value.indexOf(text, start + 1)
    }
    if (start === -1) {
      return null
    }

    const range = { start, end: start + text.length }
    placed.push(range)
    return range
  })
}

// Indices of the links whose text cannot be found in the line's value.
export function findMissingSkillLinks(line: ResumeSkillLine): Array<number> {
  return locateSkillLinks(line.value, line.links).flatMap((range, index) =>
    range ? [] : [index],
  )
}

export function hasMissingSkillLinks(data: ResumeData): boolean {
  return data.skills.some((line) => findMissingSkillLinks(line).length > 0)
}

// Removes every skill link whose text is not in its value. Missing links
// never reserve a range, so the remaining links keep their positions.
export function dropMissingSkillLinks(data: ResumeData): {
  data: ResumeData
  dropped: Array<{ line: number; text: string; url: string }>
} {
  const dropped: Array<{ line: number; text: string; url: string }> = []

  const skills = data.skills.map((line, lineIndex) => {
    const missing = new Set(findMissingSkillLinks(line))
    if (missing.size === 0) {
      return line
    }
    return {
      ...line,
      links: line.links.filter((link, linkIndex) => {
        if (!missing.has(linkIndex)) {
          return true
        }
        dropped.push({ line: lineIndex, text: link.text, url: link.url })
        return false
      }),
    }
  })

  return { data: { ...data, skills }, dropped }
}
