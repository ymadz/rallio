# Component Generator

Generate a React component for the Rallio web application.

## Context
- Components go in `web/src/components/`
- UI primitives are in `web/src/components/ui/` (shadcn/ui pattern)
- Feature components go in `web/src/components/[feature]/`
- Use TypeScript with proper prop interfaces
- Style with Tailwind CSS using the project's design tokens

## Instructions

Based on the user's request, generate a React component with:

1. **Component file**:
   - TypeScript interface for props
   - Proper imports from UI components
   - Tailwind CSS styling
   - Accessibility attributes (aria-*, role, etc.)
   - "use client" directive only if using hooks/interactivity

2. **Variants** (if applicable):
   - Use cva (class-variance-authority) for variant styles
   - Export variant types for external use

## Patterns to Follow

### Basic Component
```tsx
import { cn } from '@/lib/utils'

interface ComponentNameProps {
  className?: string
  children?: React.ReactNode
  // ... other props
}

export function ComponentName({ className, children, ...props }: ComponentNameProps) {
  return (
    <div className={cn('base-styles', className)} {...props}>
      {children}
    </div>
  )
}
```

### Interactive Component
```tsx
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ComponentNameProps {
  onAction?: () => void
}

export function ComponentName({ onAction }: ComponentNameProps) {
  const [state, setState] = useState(false)

  return (
    <Button onClick={() => {
      setState(true)
      onAction?.()
    }}>
      Click me
    </Button>
  )
}
```

### Component with Variants
```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const componentVariants = cva('base-styles', {
  variants: {
    variant: {
      default: 'default-styles',
      secondary: 'secondary-styles',
    },
    size: {
      sm: 'small-styles',
      md: 'medium-styles',
      lg: 'large-styles',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

interface ComponentNameProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {}

export function ComponentName({ className, variant, size, ...props }: ComponentNameProps) {
  return (
    <div className={cn(componentVariants({ variant, size }), className)} {...props} />
  )
}
```

## Available UI Components
Import from `@/components/ui/`:
- Button, Input, Label, Card, Form, Alert, Spinner, Separator, Avatar

## Design Tokens
Use these Tailwind classes for consistency:
- Primary: `bg-primary`, `text-primary`
- Borders: `border-border`
- Muted backgrounds: `bg-muted`
- Text: `text-foreground`, `text-muted-foreground`

## User Request
$ARGUMENTS

Generate the component based on this request. Place it in the appropriate directory and include any necessary exports.
