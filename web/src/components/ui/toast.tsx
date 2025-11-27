'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ToastProps {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  variant?: 'default' | 'success' | 'warning' | 'error'
  duration?: number
  className?: string
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      id,
      title,
      description,
      action,
      open = true,
      onOpenChange,
      variant = 'default',
      duration = 5000,
      className,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(open)
    const timerRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

    React.useEffect(() => {
      setIsVisible(open)

      if (open && duration > 0) {
        timerRef.current = setTimeout(() => {
          setIsVisible(false)
          onOpenChange?.(false)
        }, duration)
      }

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
        }
      }
    }, [open, duration, onOpenChange])

    if (!isVisible) return null

    return (
      <div
        ref={ref}
        className={cn(
          'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0',
          'data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full',
          {
            'border-gray-200 bg-white': variant === 'default',
            'border-green-200 bg-green-50': variant === 'success',
            'border-yellow-200 bg-yellow-50': variant === 'warning',
            'border-red-200 bg-red-50': variant === 'error',
          },
          className
        )}
        data-state={isVisible ? 'open' : 'closed'}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="flex-1 space-y-1">
          {title && (
            <div
              className={cn('text-sm font-semibold', {
                'text-gray-900': variant === 'default',
                'text-green-900': variant === 'success',
                'text-yellow-900': variant === 'warning',
                'text-red-900': variant === 'error',
              })}
            >
              {title}
            </div>
          )}
          {description && (
            <div
              className={cn('text-sm', {
                'text-gray-600': variant === 'default',
                'text-green-700': variant === 'success',
                'text-yellow-700': variant === 'warning',
                'text-red-700': variant === 'error',
              })}
            >
              {description}
            </div>
          )}
        </div>
        {action}
        <button
          onClick={() => {
            setIsVisible(false)
            onOpenChange?.(false)
          }}
          className={cn(
            'rounded-md p-1 transition-colors',
            'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400',
            {
              'text-gray-500 hover:text-gray-700': variant === 'default',
              'text-green-500 hover:text-green-700': variant === 'success',
              'text-yellow-500 hover:text-yellow-700': variant === 'warning',
              'text-red-500 hover:text-red-700': variant === 'error',
            }
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }
)

Toast.displayName = 'Toast'

export interface ToasterProps {
  toasts: ToastProps[]
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

export function Toaster({ toasts, position = 'top-right' }: ToasterProps) {
  return (
    <div
      className={cn(
        'fixed z-[100] flex max-h-screen flex-col gap-2 p-4',
        {
          'top-0 right-0': position === 'top-right',
          'top-0 left-0': position === 'top-left',
          'bottom-0 right-0': position === 'bottom-right',
          'bottom-0 left-0': position === 'bottom-left',
          'top-0 left-1/2 -translate-x-1/2': position === 'top-center',
          'bottom-0 left-1/2 -translate-x-1/2': position === 'bottom-center',
        }
      )}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>([])

  const toast = React.useCallback(
    (props: Omit<ToastProps, 'id' | 'open' | 'onOpenChange'>) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: ToastProps = {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            setToasts((prev) => prev.filter((t) => t.id !== id))
          }
        },
      }

      setToasts((prev) => [...prev, newToast])

      return id
    },
    []
  )

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return {
    toasts,
    toast,
    dismiss,
  }
}

export { Toast }
