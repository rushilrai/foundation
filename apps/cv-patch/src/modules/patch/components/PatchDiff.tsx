import type { ResumeData } from '@shared/resumeSchema'

type PatchDiffProps = {
  base: ResumeData
  patched: ResumeData
}

type DiffEntry = {
  path: string
  before: string
  after: string
}

function collectDiffs(base: ResumeData, patched: ResumeData): Array<DiffEntry> {
  const diffs: Array<DiffEntry> = []

  const push = (path: string, before: string, after: string) => {
    if (before !== after) {
      diffs.push({ path, before, after })
    }
  }

  base.experience.forEach((bExp, i) => {
    const pExp = patched.experience[i]
    if (!pExp) return

    bExp.roles.forEach((bRole, r) => {
      const pRole = pExp.roles[r]
      if (!pRole) return

      push(`${bExp.company} — role title`, bRole.title, pRole.title)
      bRole.bullets.forEach((bullet, b) => {
        if (pRole.bullets[b] !== undefined) {
          push(
            `${bExp.company} — ${bRole.title || 'role'} · bullet ${b + 1}`,
            bullet,
            pRole.bullets[b],
          )
        }
      })
    })
  })

  base.education.forEach((bEdu, i) => {
    const pEdu = patched.education[i]
    if (!pEdu) return
    push(`${bEdu.school} — degree`, bEdu.degree, pEdu.degree)
    push(`${bEdu.school} — details`, bEdu.details, pEdu.details)
  })

  base.projects.forEach((bProj, i) => {
    const pProj = patched.projects[i]
    if (!pProj) return
    push(`Project ${i + 1} — name`, bProj.name, pProj.name)
    bProj.bullets.forEach((bullet, b) => {
      if (pProj.bullets[b] !== undefined) {
        push(
          `${bProj.name || `Project ${i + 1}`} · bullet ${b + 1}`,
          bullet,
          pProj.bullets[b],
        )
      }
    })
  })

  push('Skills — technical', base.skills.technical, patched.skills.technical)
  push('Skills — financial', base.skills.financial, patched.skills.financial)
  push('Skills — languages', base.skills.languages, patched.skills.languages)

  base.extras.forEach((extra, i) => {
    if (patched.extras[i] !== undefined) {
      push(`Extras · ${i + 1}`, extra, patched.extras[i])
    }
  })

  return diffs
}

export const PatchDiff = ({ base, patched }: PatchDiffProps) => {
  const diffs = collectDiffs(base, patched)

  if (diffs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No differences from the base resume.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {diffs.length} change{diffs.length === 1 ? '' : 's'} vs the base resume
      </p>

      {diffs.map((diff, index) => (
        <div key={index} className="space-y-1 rounded-md border p-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {diff.path}
          </p>
          <p className="text-xs text-muted-foreground line-through decoration-destructive/50">
            {diff.before}
          </p>
          <p className="text-xs">{diff.after}</p>
        </div>
      ))}
    </div>
  )
}
