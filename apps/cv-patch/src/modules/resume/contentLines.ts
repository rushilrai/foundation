import type { ResumeData } from '@shared/resumeSchema'

// List fields (bullets, extras) are edited as one item per line. Lines are
// kept verbatim while typing — trimming or dropping blank lines on every
// keystroke would swallow a trailing space or a just-typed newline — and are
// only cleaned up when the draft is saved.
export const splitLines = (value: string): Array<string> => value.split('\n')

export const joinLines = (value: Array<string>): string => value.join('\n')

const cleanLines = (lines: Array<string>): Array<string> =>
  lines.map((line) => line.trim()).filter(Boolean)

export function cleanListFields(data: ResumeData): ResumeData {
  return {
    ...data,
    experience: data.experience.map((entry) => ({
      ...entry,
      roles: entry.roles.map((role) => ({
        ...role,
        bullets: cleanLines(role.bullets),
      })),
    })),
    projects: data.projects.map((project) => ({
      ...project,
      bullets: cleanLines(project.bullets),
    })),
    extras: cleanLines(data.extras),
  }
}
