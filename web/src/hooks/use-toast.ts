import { toast as sonnerToast } from 'sonner'

type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
  duration?: number
}

export function useToast() {
  return {
    toast: ({ title, description, variant, duration }: ToastProps) => {
      const message = title || description || ''
      const fullMessage = title && description ? `${title}: ${description}` : message
      
      if (variant === 'destructive') {
        sonnerToast.error(fullMessage, {
          duration: duration || 4000,
        })
      } else {
        sonnerToast.success(fullMessage, {
          duration: duration || 4000,
        })
      }
    },
    dismiss: (toastId?: string | number) => {
      if (toastId) {
        sonnerToast.dismiss(toastId)
      } else {
        sonnerToast.dismiss()
      }
    },
  }
}
