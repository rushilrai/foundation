import { api } from '@convex/_generated/api.js'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
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

const uploadResumeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  file: z.instanceof(File, { message: 'File is required' }),
})

type UploadResumeDialogProps = {
  children: React.ReactNode
}

export const UploadResumeDialog = ({ children }: UploadResumeDialogProps) => {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const generateUploadUrl = useAction(
    api.modules.resume.actions.generateUploadUrl,
  )
  const createResume = useMutation(api.modules.resume.mutations.create)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      title: '',
      file: null as File | null,
    },
    validators: {
      onSubmit: uploadResumeSchema,
    },
    onSubmit: async ({ value }) => {
      const file = value.file!
      setIsUploading(true)
      try {
        const urlResult = await generateUploadUrl()
        if ('error' in urlResult) {
          console.error('Failed to get upload URL:', urlResult.error)
          return
        }

        const response = await fetch(urlResult.uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        const { storageId } = await response.json()

        const result = await createResume({
          title: value.title.trim(),
          fileId: storageId,
          fileName: file.name,
          fileSize: file.size,
        })

        if ('resumeId' in result) {
          setOpen(false)
          form.reset()
          navigate({
            to: '/dashboard/resume/$id',
            params: { id: result.resumeId },
          })
        }
      } catch (error) {
        console.error('Error uploading resume:', error)
      } finally {
        setIsUploading(false)
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Resume</DialogTitle>

          <DialogDescription>
            Upload a .docx file to get started.
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
                      placeholder="My Resume"
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <form.Field
              name="file"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>File</FieldLabel>

                    <Input
                      id={field.name}
                      name={field.name}
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.files?.[0] ?? null)
                      }
                      aria-invalid={isInvalid}
                    />

                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            />

            <Button type="submit" disabled={isUploading} className="w-full">
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
