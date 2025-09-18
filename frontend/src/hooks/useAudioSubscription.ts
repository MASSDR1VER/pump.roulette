import { useState, useEffect } from 'react'
import { config } from '@/lib/config'

interface AudioSubscriptionHook {
  viewerToken: string | null
  isLoading: boolean
  error: string | null
  subscribeToAudio: (pairId: string) => Promise<void>
}

export function useAudioSubscription(): AudioSubscriptionHook {
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subscribeToAudio = async (pairId: string) => {
    if (!pairId) {
      setError('No pair ID provided')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/stream/${pairId}`)

      if (response.ok) {
        const data = await response.json()

        if (data.success && data.viewer_token) {
          setViewerToken(data.viewer_token)
          console.log('Successfully subscribed to audio stream:', pairId)
        } else {
          setError('No audio stream available for this pair')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to subscribe to audio stream')
      }
    } catch (error) {
      console.error('Failed to subscribe to audio:', error)
      setError('Network error while subscribing to audio')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    viewerToken,
    isLoading,
    error,
    subscribeToAudio
  }
}