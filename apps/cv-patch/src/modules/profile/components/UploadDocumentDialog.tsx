import { useForm } from '@tanstack/react-form'
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
import {
  useCreateDocument,
  useGenerateProfileUploadUrl,
} from '@/modules/profile/mutations'
import type { ProfileId } from '@/modules/profile/schema'

const uploadDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  kind: z.enum(['resume', 'coverLetter', 'other']),
  file: z.instanceof(File, { message: 'File is required' }),
})

type DocumentKind = z.infer<typeof uploadDocumentSchema>['kind']

type UploadDocumentDialogProps = {
  profileId: ProfileId
  children: React.ReactNode
}

export const UploadDocumentDialog = ({
  profileId,
  children,
}: UploadDocumentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const generateUploadUrl = useGenerateProfileUploadUrl()
  const createDocument = useCreateDocument()

  const form = useForm({
    defaultValues: {
      title: '',
      kind: 'resume' as DocumentKind,
      file: null as File | null,
    },
    validators: {
      onSubmit: uploadDocumentSchema,
    },
    onSubmit: async ({ value }) => {
      const file = value.file!
      setIsUploading(true)
      setUploadError(null)
      try {
        const urlResult = await generateUploadUrl()
        if ('error' in urlResult) {
          console.error('Failed to get upload URL:', urlResult.error)
          setUploadError('Failed to start the upload. Try again.')
          return
        }

        const response = await fetch(urlResult.uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!response.ok) {
          console.error('Failed to upload file:', response.status)
          setUploadError('Failed to upload the file. Try again.')
          return
        }
        const { storageId } = await response.json()

        const result = await createDocument({
          profileId,
          kind: value.kind,
          title: value.title.trim(),
          fileId: storageId,
          fileName: file.name,
          fileSize: file.size,
        })

        if ('error' in result) {
          console.error('Failed to create document:', result.error)
          setUploadError('Failed to save the document. Try again.')
          return
        }

        setOpen(false)
        form.reset()
      } catch (error) {
        console.error('Error uploading document:', error)
        setUploadError('Something went wrong while uploading. Try again.')
      } finally {
        setIsUploading(false)
      }
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setUploadError(null)
      }}
    >
      <DialogTrigger render={children as React.ReactElement} />

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>

          <DialogDescription>
            Upload a .docx, .pdf, .tex, or .txt file for the agent to read.
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
              name="kind"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Kind</FieldLabel>

                    <select
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value as DocumentKind)
                      }
                      aria-invalid={isInvalid}
                      className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      <option value="resume">Resume</option>
                      <option value="coverLetter">Cover letter</option>
                      <option value="other">Other</option>
                    </select>

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
                      accept=".docx,.pdf,.tex,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
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

            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}

            <Button type="submit" disabled={isUploading} className="w-full">
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
