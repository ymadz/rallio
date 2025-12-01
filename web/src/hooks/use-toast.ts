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
      // Format message with title and description
      let message = ''
      if (title && description) {
        message = `${title}\n${description}`
      } else {
        message = title || description || ''
      }
      
      if (variant === 'destructive') {
        sonnerToast.error(message, {
          duration: duration || 5000,
          style: {
            whiteSpace: 'pre-line',
          },
        })
      } else {
        sonnerToast.success(message, {
          duration: duration || 4000,
          style: {
            whiteSpace: 'pre-line',
          },
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
