import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreatePatch } from '@/modules/patch/mutations'
import type { ProfileId } from '@/modules/profile/schema'

const createPatchSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  roleName: z.string().min(1, 'Role name is required'),
  jobDescription: z.string().min(1, 'Job description is required'),
})

type CreatePatchDialogProps = {
  profileId: ProfileId
  children: React.ReactNode
}

export const CreatePatchDialog = ({
  profileId,
  children,
}: CreatePatchDialogProps) => {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const createPatch = useCreatePatch()
  const navigate = useNavigate()

  const generateTitle = (companyName: string, roleName: string) => {
    return `${companyName.trim()} - ${roleName.trim()}`
  }

  const form = useForm({
    defaultValues: {
      companyName: '',
      roleName: '',
      jobDescription: '',
    },
    validators: {
      onSubmit: createPatchSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await createPatch({
          profileId,
          title: generateTitle(value.companyName, value.roleName),
          jobDescription: value.jobDescription.trim(),
          companyName: value.companyName.trim(),
          roleName: value.roleName.trim(),
        })

        if ('patchId' in result) {
          setOpen(false)
          form.reset()
          navigate({
            to: '/dashboard/profile/$id/patch/$patchId',
            params: { id: profileId, patchId: result.patchId },
          })
        } else {
          setSubmitError(
            result.error === 'RATE_LIMITED'
              ? 'Rate limit reached. Try again in a little while.'
              : result.error === 'PROFILE_EMPTY'
                ? 'Add some experience or projects to the profile first.'
                : 'Failed to create the variant. Please try again.',
          )
        }
      } catch (error) {
        console.error('Error creating patch:', error)
        setSubmitError('Failed to create the variant. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Tailored Variant</DialogTitle>

          <DialogDescription>
            Paste the job description and we'll tailor your resume to match.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <form.Field
                name="companyName"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Company Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Acme Inc."
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />

              <form.Field
                name="roleName"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Role Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Software Engineer"
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              />
            </div>

            <form.Field
              name="jobDescription"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Job Description
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Paste the full job description here..."
                      className="max-h-100 min-h-50 overflow-y-auto"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Generating...' : 'Generate Variant'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
