import { InlineError } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/Wordmark'
import { useSignOutMutation } from '@/modules/auth/mutations'
import { useCurrentUser } from '@/modules/auth/queries'

// Placeholder until the link list lands.
export const HomeScreen = () => {
  const user = useCurrentUser()
  const signOut = useSignOutMutation()

  return (
    <main className="page-column">
      <header className="flex items-center justify-between border-b py-4">
        <Wordmark />

        <Button
          variant="ghost"
          size="sm"
          className="-mr-3 text-muted-foreground"
          disabled={signOut.isPending || signOut.isSuccess}
          onClick={() => signOut.mutate()}
        >
          Sign out
        </Button>
      </header>

      {user && (
        <p className="mt-4 truncate font-mono text-xs text-faint-foreground">
          {user.email}
        </p>
      )}

      <InlineError className="mt-4">{signOut.error?.message}</InlineError>

      <p className="py-24 text-center font-serif text-xl text-muted-foreground italic">
        No links yet.
      </p>
    </main>
  )
}
