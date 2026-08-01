import { ProfileDataSchema, type ProfileData } from '@shared/profileSchema'
import { MAX_HEADER_LINKS } from '@shared/resumeSchema'
import { useEffect, useMemo, useRef, useState } from 'react'

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
import { useUpdateProfileData } from '@/modules/profile/mutations'
import type { Profile } from '@/modules/profile/schema'

type ProfileContentTabProps = {
  profile: Profile
}

const lineToArray = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

const arrayToLines = (value: Array<string>) => value.join('\n')

export const ProfileContentTab = ({ profile }: ProfileContentTabProps) => {
  const [draft, setDraft] = useState<ProfileData>(profile.data)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const updateData = useUpdateProfileData()

  // Agent-run bookkeeping patches re-emit a deep-equal `data` reference, so
  // only reset the draft when the serialized data actually changed.
  const lastSyncedDataRef = useRef(JSON.stringify(profile.data))

  useEffect(() => {
    const serialized = JSON.stringify(profile.data)
    if (serialized === lastSyncedDataRef.current) {
      return
    }
    lastSyncedDataRef.current = serialized
    setDraft(profile.data)
  }, [profile.data])

  const jsonValue = useMemo(() => JSON.stringify(draft, null, 2), [draft])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await updateData({ profileId: profile._id, data: draft })
      if ('error' in result) {
        setSaveError(
          result.error === 'TOO_MANY_HEADER_LINKS'
            ? `Use at most ${MAX_HEADER_LINKS} header links.`
            : 'Failed to save changes.',
        )
      }
    } catch (error) {
      console.error('Failed to save profile data', error)
      setSaveError('Failed to save changes.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateRoleBrief = (value: string) => {
    setDraft((prev) => ({
      ...prev,
      roleBrief: value,
    }))
  }

  const updateHeader = (
    key: 'name' | 'phone' | 'email' | 'location',
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      header: { ...prev.header, [key]: value },
    }))
  }

  const updateLink = (index: number, key: 'label' | 'url', value: string) => {
    setDraft((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        links: prev.header.links.map((link, i) =>
          i === index ? { ...link, [key]: value } : link,
        ),
      },
    }))
  }

  const addLink = () => {
    setDraft((prev) => {
      if (prev.header.links.length >= MAX_HEADER_LINKS) {
        return prev
      }
      return {
        ...prev,
        header: {
          ...prev.header,
          links: [...prev.header.links, { label: '', url: '' }],
        },
      }
    })
  }

  const removeLink = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        links: prev.header.links.filter((_, i) => i !== index),
      },
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
    key: 'name' | 'url' | 'dates',
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
      projects: [
        ...prev.projects,
        { name: '', url: '', dates: '', bullets: [] },
      ],
    }))
  }

  const removeProject = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }))
  }

  const updateSkills = (key: keyof ProfileData['skills'], value: string) => {
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

  const updateVoice = (key: keyof ProfileData['voice'], value: string) => {
    setDraft((prev) => ({
      ...prev,
      voice: { ...prev.voice, [key]: value },
    }))
  }

  const handleJsonApply = (value: string) => {
    try {
      const parsed = JSON.parse(value)
      const validated = ProfileDataSchema.parse(parsed)
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
          <h3 className="text-lg font-semibold">Profile Content</h3>
          <p className="text-sm text-muted-foreground">
            Edit the master record the tailoring agent draws from.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

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
                  Paste valid JSON matching the profile schema.
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
        <h4 className="text-md font-semibold">Role Brief</h4>
        <Textarea
          value={draft.roleBrief}
          onChange={(e) => updateRoleBrief(e.target.value)}
          placeholder="What kinds of roles this profile targets (titles, seniority, industries)"
        />
      </section>

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
            value={draft.header.location}
            onChange={(e) => updateHeader('location', e.target.value)}
            placeholder="Location (e.g. London, UK)"
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Links ({draft.header.links.length}/{MAX_HEADER_LINKS})
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={addLink}
              disabled={draft.header.links.length >= MAX_HEADER_LINKS}
            >
              Add Link
            </Button>
          </div>
          {draft.header.links.map((link, index) => (
            <div key={`link-${index}`} className="flex items-center gap-2">
              <Input
                value={link.label}
                onChange={(e) => updateLink(index, 'label', e.target.value)}
                placeholder="Label (e.g. LinkedIn)"
                className="w-48"
              />
              <Input
                value={link.url}
                onChange={(e) => updateLink(index, 'url', e.target.value)}
                placeholder="URL (as shown on the resume)"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLink(index)}
              >
                Remove
              </Button>
            </div>
          ))}
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
          <div key={`edu-${index}`} className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
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
          <div key={`exp-${index}`} className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
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
                className="space-y-2 rounded-md border p-3"
              >
                <div className="flex items-center justify-between">
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
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="flex items-center justify-between">
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
            <div className="grid grid-cols-2 gap-4">
              <Input
                value={project.url}
                onChange={(e) => updateProject(index, 'url', e.target.value)}
                placeholder="URL (leave empty if none)"
              />
              <Input
                value={project.dates}
                onChange={(e) => updateProject(index, 'dates', e.target.value)}
                placeholder="Dates"
              />
            </div>
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

      <section className="space-y-4">
        <h4 className="text-md font-semibold">Voice</h4>
        <Textarea
          value={draft.voice.sampleCoverLetter}
          onChange={(e) => updateVoice('sampleCoverLetter', e.target.value)}
          placeholder="Sample cover letter (full text, used to match your voice)"
          className="min-h-40"
        />
        <Textarea
          value={draft.voice.styleNotes}
          onChange={(e) => updateVoice('styleNotes', e.target.value)}
          placeholder="Style notes (sentence rhythm, vocabulary, register)"
        />
        <Textarea
          value={draft.voice.personalNotes}
          onChange={(e) => updateVoice('personalNotes', e.target.value)}
          placeholder="Personal notes (life and motivation details beyond resume facts)"
        />
      </section>
    </div>
  )
}
