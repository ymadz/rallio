# Form Generator

Generate a form component with React Hook Form and Zod validation for Rallio.

## Context
- Forms use React Hook Form with `@hookform/resolvers/zod`
- Validation schemas can come from `@rallio/shared/validations` or be created inline
- UI components from `@/components/ui/` (Input, Button, Label, Form, Alert)
- Forms submit to Server Actions or API endpoints

## Instructions

Based on the user's request, generate:

1. **Form component**:
   - Zod validation schema
   - React Hook Form setup with zodResolver
   - Proper TypeScript types
   - Loading and error states
   - Success feedback

2. **Server Action** (if needed):
   - Validate input server-side
   - Handle database operations
   - Return typed response

## Patterns to Follow

### Basic Form with Server Action
```tsx
"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof formSchema>

interface FormNameProps {
  onSuccess?: () => void
}

export function FormName({ onSuccess }: FormNameProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Call server action or API
      const result = await serverAction(data)

      if (result.error) {
        setError(result.error)
        return
      }

      reset()
      onSuccess?.()
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Submit'}
      </Button>
    </form>
  )
}
```

### Form with Select/Dropdown
```tsx
<div className="space-y-2">
  <Label htmlFor="courtType">Court Type</Label>
  <select
    id="courtType"
    className="w-full rounded-md border border-input bg-background px-3 py-2"
    {...register('courtType')}
  >
    <option value="">Select type</option>
    <option value="indoor">Indoor</option>
    <option value="outdoor">Outdoor</option>
  </select>
  {errors.courtType && (
    <p className="text-sm text-destructive">{errors.courtType.message}</p>
  )}
</div>
```

### Form with Textarea
```tsx
<div className="space-y-2">
  <Label htmlFor="notes">Notes</Label>
  <textarea
    id="notes"
    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2"
    placeholder="Add any notes..."
    {...register('notes')}
  />
</div>
```

## Shared Validations
Import from `@rallio/shared`:
- `loginSchema`, `signupSchema`, `forgotPasswordSchema`
- `profileSchema`, `playerProfileSchema`
- `courtSearchSchema`, `reservationSchema`
- `queueJoinSchema`, `queueCreateSchema`
- `courtRatingSchema`, `playerRatingSchema`

## User Request
$ARGUMENTS

Generate the form component based on this request. Include the Zod schema, form component, and server action if needed.
