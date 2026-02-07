import { useMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@convex/_generated/api.js'
import {
  ResumeDataSchema,
  getEmptyResumeData,
} from '@shared/resumeSchema'
import type { Doc } from '@convex/_generated/dataModel.js'

import type {
  ResumeData} from '@shared/resumeSchema';
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'


type ResumeContentTabProps = {
  resume: Doc<'resumes'>
}

const lineToArray = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const arrayToLines = (value: Array<string>) => value.join('\n')

export const ResumeContentTab = ({ resume }: ResumeContentTabProps) => {
  const [draft, setDraft] = useState<ResumeData>(
    resume.data ?? getEmptyResumeData(),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const updateData = useMutation(api.modules.resume.mutations.updateData)

  useEffect(() => {
    if (resume.data) {
      setDraft(resume.data)
    }
  }, [resume.data])

  if (resume.status === 'error') {
    return (
      <div className="text-sm text-destructive">
        {resume.errorMessage || 'Failed to extract resume content.'}
      </div>
    )
  }

  if (resume.status !== 'ready' || !resume.data) {
    return (
      <div className="text-sm text-muted-foreground">
        Resume content is still being processed. Please refresh once it is
        ready.
      </div>
    )
  }

  const jsonValue = useMemo(() => JSON.stringify(draft, null, 2), [draft])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateData({ resumeId: resume._id, data: draft })
    } catch (error) {
      console.error('Failed to save resume data', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updateHeader = (key: keyof ResumeData['header'], value: string) => {
    setDraft((prev) => ({
      ...prev,
      header: { ...prev.header, [key]: value },
    }))
  }

  const updateEducation = (
    index: number,
    key: 'school' | 'location' | 'dates' | 'degree' | 'details',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      education: prev.education.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }))
  }

  const updateExperience = (
    index: number,
    key: 'company' | 'companyMeta',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }))
  }

  const updateRole = (
    expIndex: number,
    roleIndex: number,
    key: 'title' | 'meta',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) => {
        if (i !== expIndex) return exp
        return {
          ...exp,
          roles: exp.roles.map((role, r) =>
            r === roleIndex ? { ...role, [key]: value } : role,
          ),
        }
      }),
    }))
  }

  const updateRoleBullets = (
    expIndex: number,
    roleIndex: number,
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) => {
        if (i !== expIndex) return exp
        return {
          ...exp,
          roles: exp.roles.map((role, r) =>
            r === roleIndex ? { ...role, bullets: lineToArray(value) } : role,
          ),
        }
      }),
    }))
  }

  const addEducation = () => {
    setDraft((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        { school: '', location: '', dates: '', degree: '', details: '' },
      ],
    }))
  }

  const removeEducation = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }))
  }

  const addExperience = () => {
    setDraft((prev) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { company: '', companyMeta: '', roles: [] },
      ],
    }))
  }

  const removeExperience = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index),
    }))
  }

  const addRole = (expIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? {
              ...exp,
              roles: [...exp.roles, { title: '', meta: '', bullets: [] }],
            }
          : exp,
      ),
    }))
  }

  const removeRole = (expIndex: number, roleIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      experience: prev.experience.map((exp, i) =>
        i === expIndex
          ? {
              ...exp,
              roles: exp.roles.filter((_, r) => r !== roleIndex),
            }
          : exp,
      ),
    }))
  }

  const updateProject = (
    index: number,
    key: 'name' | 'dates',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }))
  }

  const updateProjectBullets = (index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.map((project, i) =>
        i === index ? { ...project, bullets: lineToArray(value) } : project,
      ),
    }))
  }

  const addProject = () => {
    setDraft((prev) => ({
      ...prev,
      projects: [...prev.projects, { name: '', dates: '', bullets: [] }],
    }))
  }

  const removeProject = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }))
  }

  const updateSkills = (key: keyof ResumeData['skills'], value: string) => {
    setDraft((prev) => ({
      ...prev,
      skills: { ...prev.skills, [key]: value },
    }))
  }

  const updateExtras = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      extras: lineToArray(value),
    }))
  }

  const handleJsonApply = (value: string) => {
    try {
      const parsed = JSON.parse(value)
      const validated = ResumeDataSchema.parse(parsed)
      setDraft(validated)
      setJsonOpen(false)
    } catch (error) {
      console.error('Invalid JSON', error)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resume Content</h3>
          <p className="text-sm text-muted-foreground">
            Edit your resume content before generating variants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={jsonOpen}
            onOpenChange={(open) => {
              setJsonOpen(open)
              if (open) {
                setJsonDraft(jsonValue)
              }
            }}
          >
            <DialogTrigger
              render={
                <Button variant="outline" size="sm">
                  Advanced JSON
                </Button>
              }
            />
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Edit JSON</DialogTitle>
                <DialogDescription>
                  Paste valid JSON matching the resume schema.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                className="min-h-80 font-mono text-xs"
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={() => handleJsonApply(jsonDraft)}>
                  Apply
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h4 className="text-md font-semibold">Header</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            value={draft.header.name}
            onChange={(e) => updateHeader('name', e.target.value)}
            placeholder="Name"
          />
          <Input
            value={draft.header.phone}
            onChange={(e) => updateHeader('phone', e.target.value)}
            placeholder="Phone"
          />
          <Input
            value={draft.header.email}
            onChange={(e) => updateHeader('email', e.target.value)}
            placeholder="Email"
          />
          <Input
            value={draft.header.linkedin}
            onChange={(e) => updateHeader('linkedin', e.target.value)}
            placeholder="LinkedIn"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Education</h4>
          <Button variant="outline" size="sm" onClick={addEducation}>
            Add Education
          </Button>
        </div>
        {draft.education.map((edu, index) => (
          <div key={`edu-${index}`} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Entry {index + 1}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEducation(index)}
              >
                Remove
              </Button>
            </div>
            <Input
              value={edu.school}
              onChange={(e) => updateEducation(index, 'school', e.target.value)}
              placeholder="School"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                value={edu.location}
                onChange={(e) =>
                  updateEducation(index, 'location', e.target.value)
                }
                placeholder="Location"
              />
              <Input
                value={edu.dates}
                onChange={(e) =>
                  updateEducation(index, 'dates', e.target.value)
                }
                placeholder="Dates"
              />
            </div>
            <Input
              value={edu.degree}
              onChange={(e) => updateEducation(index, 'degree', e.target.value)}
              placeholder="Degree"
            />
            <Textarea
              value={edu.details}
              onChange={(e) =>
                updateEducation(index, 'details', e.target.value)
              }
              placeholder="Details"
            />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Experience</h4>
          <Button variant="outline" size="sm" onClick={addExperience}>
            Add Company
          </Button>
        </div>
        {draft.experience.map((exp, index) => (
          <div key={`exp-${index}`} className="border rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Company {index + 1}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeExperience(index)}
              >
                Remove
              </Button>
            </div>
            <Input
              value={exp.company}
              onChange={(e) =>
                updateExperience(index, 'company', e.target.value)
              }
              placeholder="Company"
            />
            <Input
              value={exp.companyMeta}
              onChange={(e) =>
                updateExperience(index, 'companyMeta', e.target.value)
              }
              placeholder="Company Meta (location | dates)"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Roles</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addRole(index)}
              >
                Add Role
              </Button>
            </div>
            {exp.roles.map((role, roleIndex) => (
              <div
                key={`role-${roleIndex}`}
                className="border rounded-md p-3 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium">Role {roleIndex + 1}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRole(index, roleIndex)}
                  >
                    Remove
                  </Button>
                </div>
                <Input
                  value={role.title}
                  onChange={(e) =>
                    updateRole(index, roleIndex, 'title', e.target.value)
                  }
                  placeholder="Role title"
                />
                <Input
                  value={role.meta}
                  onChange={(e) =>
                    updateRole(index, roleIndex, 'meta', e.target.value)
                  }
                  placeholder="Role meta (location | dates)"
                />
                <Textarea
                  value={arrayToLines(role.bullets)}
                  onChange={(e) =>
                    updateRoleBullets(index, roleIndex, e.target.value)
                  }
                  placeholder="Bullets (one per line)"
                  className="min-h-24"
                />
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold">Projects</h4>
          <Button variant="outline" size="sm" onClick={addProject}>
            Add Project
          </Button>
        </div>
        {draft.projects.map((project, index) => (
          <div
            key={`project-${index}`}
            className="border rounded-lg p-4 space-y-3"
          >
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Project {index + 1}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeProject(index)}
              >
                Remove
              </Button>
            </div>
            <Input
              value={project.name}
              onChange={(e) => updateProject(index, 'name', e.target.value)}
              placeholder="Project name"
            />
            <Input
              value={project.dates}
              onChange={(e) => updateProject(index, 'dates', e.target.value)}
              placeholder="Dates"
            />
            <Textarea
              value={arrayToLines(project.bullets)}
              onChange={(e) => updateProjectBullets(index, e.target.value)}
              placeholder="Bullets (one per line)"
              className="min-h-24"
            />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h4 className="text-md font-semibold">Skills</h4>
        <Textarea
          value={draft.skills.technical}
          onChange={(e) => updateSkills('technical', e.target.value)}
          placeholder="Technical skills"
        />
        <Textarea
          value={draft.skills.financial}
          onChange={(e) => updateSkills('financial', e.target.value)}
          placeholder="Financial skills"
        />
        <Textarea
          value={draft.skills.languages}
          onChange={(e) => updateSkills('languages', e.target.value)}
          placeholder="Languages"
        />
      </section>

      <section className="space-y-4">
        <h4 className="text-md font-semibold">Extras</h4>
        <Textarea
          value={arrayToLines(draft.extras)}
          onChange={(e) => updateExtras(e.target.value)}
          placeholder="Extras (one per line)"
        />
      </section>
    </div>
  )
}
