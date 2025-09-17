import { useState, useCallback } from 'react'

export interface Stream {
  stream_id: string
  streamer_id: string
  stream_url: string
  token_name: string
  token_address: string
  streamer_name: string
  viewer_count: number
  thumbnail_url?: string
  access_token?: string
  room_id?: string
  [key: string]: any // Allow additional properties from backend
}

export interface StreamPair {
  room_id: string
  stream_1: Stream
  stream_2: Stream
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://app.pump-roulette.com/api/v1'

export function useStreamPair() {
  const [streamPair, setStreamPair] = useState<StreamPair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNewPair = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      // Fetch from backend API (using streams for better live validation)
      const response = await fetch(`${API_BASE_URL}/streams/random-pair`)

      if (!response.ok) {
        if (response.status === 503) {
          // No live streams available
          setError('No live streams available. Please try again later.')
          return false
        }
        throw new Error(`Failed to fetch: ${response.statusText}`)
      }

      const data = await response.json()

      // Verify both streams are actually live before setting
      if (data.stream_1 && data.stream_2) {
        try {
          const [verify1, verify2] = await Promise.all([
            fetch(`${API_BASE_URL}/streams/verify/${data.stream_1.stream_id}`).then(r => r.json()),
            fetch(`${API_BASE_URL}/streams/verify/${data.stream_2.stream_id}`).then(r => r.json())
          ])

          if (!verify1.is_live || !verify2.is_live) {
            console.warn('One or both streams are not live, fetching new pair')
            // Recursively fetch new pair if either stream is not live
            return fetchNewPair()
          }
        } catch (verifyError) {
          console.warn('Failed to verify streams, using them anyway:', verifyError)
        }
      }

      setStreamPair(data)
      setError(null)
      return true
    } catch (err) {
      console.error('Error fetching stream pair:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stream pair'
      setError(errorMessage)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    streamPair,
    loading,
    error,
    fetchNewPair
  }
}