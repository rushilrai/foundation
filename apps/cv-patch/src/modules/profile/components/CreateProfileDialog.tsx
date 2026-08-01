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
import { useCreateProfile } from '@/modules/profile/mutations'

const createProfileSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  roleBrief: z.string(),
})

type CreateProfileDialogProps = {
  children: React.ReactNode
}

export const CreateProfileDialog = ({ children }: CreateProfileDialogProps) => {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const createProfile = useCreateProfile()
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      title: '',
      roleBrief: '',
    },
    validators: {
      onSubmit: createProfileSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const roleBrief = value.roleBrief.trim()
        const result = await createProfile({
          title: value.title.trim(),
          ...(roleBrief && { roleBrief }),
        })

        if ('profileId' in result) {
          setOpen(false)
          form.reset()
          navigate({
            to: '/dashboard/profile/$id',
            params: { id: result.profileId },
          })
        } else {
          setSubmitError('Failed to create the profile. Please try again.')
        }
      } catch (error) {
        console.error('Error creating profile:', error)
        setSubmitError('Failed to create the profile. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Profile</DialogTitle>

          <DialogDescription>
            A profile is the master record of your career for one family of
            target roles.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="title"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Title</FieldLabel>

                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Software Engineering"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="roleBrief"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      What roles is this profile for?
                    </FieldLabel>

                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Optional — e.g. backend engineering roles at fintech startups, mid to senior level"
                      className="min-h-24"
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
              {isSubmitting ? 'Creating...' : 'Create Profile'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
