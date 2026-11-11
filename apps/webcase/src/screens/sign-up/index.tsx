import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'

import { InlineError } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Wordmark } from '@/components/Wordmark'
import { AuthTextField } from '@/modules/auth/components/AuthTextField'
import { useSignUpMutation } from '@/modules/auth/mutations'
import { MIN_PASSWORD_LENGTH, signUpSchema } from '@/modules/auth/schema'

type SignUpScreenProps = {
  redirect: string | undefined
}

export const SignUpScreen = ({ redirect }: SignUpScreenProps) => {
  const signUp = useSignUpMutation(redirect)

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: {
      onChange: signUpSchema,
      onBlur: signUpSchema,
      onSubmit: signUpSchema,
    },
    // The error is shown from the mutation's state.
    onSubmit: ({ value }) => signUp.mutateAsync(value).catch(() => undefined),
  })

  // Stays busy after success while the page reloads into the app.
  const isBusy = signUp.isPending || signUp.isSuccess

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col justify-center py-12">
        <Wordmark className="text-3xl" />

        <h1 className="mt-10 font-serif text-2xl font-medium">
          Create an account
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          One place for every link worth keeping.
        </p>

        <form
          className="mt-8"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="name"
              children={(field) => (
                <AuthTextField
                  name={field.name}
                  label="Name"
                  type="text"
                  autoComplete="name"
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  errors={field.state.meta.errors}
                  showErrors={
                    field.state.meta.isBlurred ||
                    form.state.submissionAttempts > 0
                  }
                />
              )}
            />

            <form.Field
              name="email"
              children={(field) => (
                <AuthTextField
                  name={field.name}
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  errors={field.state.meta.errors}
                  showErrors={
                    field.state.meta.isBlurred ||
                    form.state.submissionAttempts > 0
                  }
                />
              )}
            />

            <form.Field
              name="password"
              children={(field) => (
                <AuthTextField
                  name={field.name}
                  label={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  errors={field.state.meta.errors}
                  showErrors={
                    field.state.meta.isBlurred ||
                    form.state.submissionAttempts > 0
                  }
                />
              )}
            />

            <InlineError>{signUp.error?.message}</InlineError>

            <Button type="submit" size="lg" className="h-11" disabled={isBusy}>
              {isBusy ? 'Creating account…' : 'Create account'}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/sign-in"
            search={{ redirect }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
