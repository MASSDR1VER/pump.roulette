import { useState, useCallback } from 'react'
import { config } from '@/lib/config'

const API_BASE_URL = config.api.baseUrl || 'https://app.pump-roulette.com'

interface AudioTokens {
  room_id: string
  streamer_token?: string
  viewer_token?: string
}

export function useAudioRoom() {
  const [audioTokens, setAudioTokens] = useState<AudioTokens | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAudioRoom = useCallback(async (pairId: string, streamerId?: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pair_id: pairId,
          streamer_id: streamerId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create audio room: ${response.statusText}`)
      }

      const data = await response.json()
      setAudioTokens(data)
      return data
    } catch (err) {
      console.error('Error creating audio room:', err)
      setError(err instanceof Error ? err.message : 'Failed to create audio room')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getViewerToken = useCallback(async (pairId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/audio/viewer-token/${pairId}`)

      if (!response.ok) {
        throw new Error(`Failed to get viewer token: ${response.statusText}`)
      }

      const data = await response.json()
      setAudioTokens(data)
      return data
    } catch (err) {
      console.error('Error getting viewer token:', err)
      setError(err instanceof Error ? err.message : 'Failed to get viewer token')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    audioTokens,
    loading,
    error,
    createAudioRoom,
    getViewerToken,
  }
}