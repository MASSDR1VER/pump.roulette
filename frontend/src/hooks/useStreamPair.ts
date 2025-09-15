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
}

export interface StreamPair {
  room_id: string
  stream_1: Stream
  stream_2: Stream
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export function useStreamPair() {
  const [streamPair, setStreamPair] = useState<StreamPair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNewPair = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch from backend API
      const response = await fetch(`${API_BASE_URL}/streams/random-pair`)

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`)
      }

      const data = await response.json()
      setStreamPair(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching stream pair:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch stream pair')
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