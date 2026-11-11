import { useForm } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { Wordmark } from '@/components/Wordmark'
import { AuthTextField } from '@/modules/auth/components/AuthTextField'
import { useSignInMutation } from '@/modules/auth/mutations'
import { signInSchema } from '@/modules/auth/schema'

type SignInScreenProps = {
  redirect: string | undefined
}

export const SignInScreen = ({ redirect }: SignInScreenProps) => {
  const signIn = useSignInMutation(redirect)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: {
      onChange: signInSchema,
      onBlur: signInSchema,
      onSubmit: signInSchema,
    },
    // The error is shown from the mutation's state.
    onSubmit: ({ value }) => signIn.mutateAsync(value).catch(() => undefined),
  })

  // Stays busy after success while the page reloads into the app.
  const isBusy = signIn.isPending || signIn.isSuccess

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col justify-center py-12">
        <Wordmark className="text-3xl" />

        <h1 className="mt-10 font-serif text-2xl font-medium">Sign in</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Your saved links are waiting.
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
                  label="Password"
                  type="password"
                  autoComplete="current-password"
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

            {signIn.error && (
              <p role="alert" className="text-sm text-destructive">
                {signIn.error.message}
              </p>
            )}

            <Button type="submit" size="lg" className="h-11" disabled={isBusy}>
              {isBusy ? 'Signing in…' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          New to Webcase?{' '}
          <Link
            to="/sign-up"
            search={{ redirect }}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
