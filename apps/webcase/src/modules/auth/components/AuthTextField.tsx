import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type AuthTextFieldProps = {
  name: string
  label: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  // Shown once the field has been touched or the form submitted.
  errors: Array<{ message?: string } | undefined>
  showErrors: boolean
}

export const AuthTextField = ({
  name,
  label,
  type,
  autoComplete,
  value,
  onChange,
  onBlur,
  errors,
  showErrors,
}: AuthTextFieldProps) => {
  const isInvalid = showErrors && errors.length > 0
  const errorId = `${name}-error`

  return (
    <Field data-invalid={isInvalid} className="gap-1">
      <FieldLabel htmlFor={name} className="text-muted-foreground">
        {label}
      </FieldLabel>

      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        autoCapitalize={type === 'text' ? 'words' : 'none'}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? errorId : undefined}
      />

      {isInvalid && <FieldError id={errorId} errors={errors} />}
    </Field>
  )
}
