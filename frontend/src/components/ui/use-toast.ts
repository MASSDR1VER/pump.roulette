import { useState, useCallback } from 'react'

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>([])

  const toast = useCallback((options: ToastOptions) => {
    // Simple console log for now - you can implement actual toast notifications later
    console.log('Toast:', options)

    // You could implement a real toast system here
    setToasts(prev => [...prev, options])

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.slice(1))
    }, 3000)
  }, [])

  return { toast, toasts }
}