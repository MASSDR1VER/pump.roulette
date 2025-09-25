import { useState, useCallback, useRef } from 'react'
import { config } from '@/lib/config'

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

const API_BASE_URL = config.api.baseUrl ? `${config.api.baseUrl}/api/v1` : 'https://app.pump-roulette.com/api/v1'

export function useStreamPair() {
  const [streamPair, setStreamPair] = useState<StreamPair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const fetchNewPair = useCallback(async (): Promise<boolean> => {
    // Don't start if already loading (use ref to prevent race conditions)
    if (loadingRef.current) {
      console.log('Already fetching stream pair, skipping...')
      return false
    }

    loadingRef.current = true
    setLoading(true)
    setError(null)

    // Clear previous stream pair immediately to prevent showing old data
    setStreamPair(null)
    console.log('Cleared previous stream pair, fetching new...')

    // Try multiple times to get a valid pair
    const maxRetries = 3
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Fetching stream pair... (attempt ${attempt + 1}/${maxRetries})`)

        // Fetch from backend API (using streams for better live validation)
        const response = await fetch(`${API_BASE_URL}/streams/random-pair`)

        if (!response.ok) {
          if (response.status === 503) {
            // No live streams available
            if (attempt === maxRetries - 1) {
              setError('No live streams available. Please try again later.')
              return false
            }
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
          throw new Error(`Failed to fetch: ${response.statusText}`)
        }

        const data = await response.json()

        // API already returns live streams, no need to verify
        console.log('Full API response:', data)

        if (data.stream_1 && data.stream_2) {
          console.log('Stream pair received:', {
            room_id: data.room_id,
            stream1: data.stream_1.token_name,
            stream2: data.stream_2.token_name
          })

          // Validate that both streams have LiveKit info
          if (!data.stream_1.room_id || !data.stream_2.room_id) {
            console.warn('Stream missing LiveKit info, retrying...')
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500))
              continue
            }
          }

          setStreamPair(data)
          setError(null)

      // Store the full stream data in the backend for this room
      if (data.room_id && data.stream_1 && data.stream_2) {
        try {
          const storeResponse = await fetch(`${API_BASE_URL}/chat/room/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              room_id: data.room_id,
              stream_1: data.stream_1,
              stream_2: data.stream_2
            })
          })

          if (storeResponse.ok) {
            const storeResult = await storeResponse.json()
            console.log('Stored full stream data in backend:', storeResult)
          } else {
            console.warn('Failed to store stream data in backend:', storeResponse.status)
          }
        } catch (storeError) {
          console.error('Error storing stream data in backend:', storeError)
          // Don't fail the main operation if storage fails
        }
      }

          // Clear loading state on success
          loadingRef.current = false
          setLoading(false)
          return true
        }

        // If we get here, no valid streams in response
        lastError = 'No valid streams in response'
        console.warn(lastError)

      } catch (err) {
        console.error(`Error on attempt ${attempt + 1}:`, err)
        lastError = err instanceof Error ? err.message : 'Failed to fetch stream pair'
      }

      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // All retries failed
    const errorMessage = lastError || 'Failed to fetch stream pair after multiple attempts'
    setError(errorMessage)
    loadingRef.current = false
    setLoading(false)
    return false
  }, [])

  return {
    streamPair,
    loading,
    error,
    fetchNewPair
  }
}