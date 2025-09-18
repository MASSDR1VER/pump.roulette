/**
 * Dynamic Route for Custom Token Pair URLs
 * Handles URLs like: /token1+token2
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { config } from '@/lib/config'
import { Loader2 } from 'lucide-react'

export default function TokenPairPage({
  params
}: {
  params: { tokens: string }
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processTokens = async () => {
      try {
        // Parse the tokens parameter (token1+token2)
        const tokensString = decodeURIComponent(params.tokens)

        console.log('Raw params.tokens:', params.tokens)
        console.log('Decoded tokensString:', tokensString)

        // Split by + to get two token addresses
        // Also try splitting by space in case + is encoded as space
        let tokenParts = tokensString.split('+')

        // If splitting by + didn't work (only one part), try splitting by space
        if (tokenParts.length === 1 && tokensString.includes(' ')) {
          tokenParts = tokensString.split(' ')
          console.log('Split by space instead:', tokenParts)
        }

        console.log('Token parts:', tokenParts)

        if (tokenParts.length !== 2) {
          throw new Error(`Invalid URL format. Expected: /token1+token2. Got: ${tokensString}`)
        }

        const [token1, token2] = tokenParts

        // Remove any trailing extensions like .pump
        const cleanToken1 = token1.replace(/\.(pump|fun)$/i, '')
        const cleanToken2 = token2.replace(/\.(pump|fun)$/i, '')

        console.log('Processing custom token pair:', { token1: cleanToken1, token2: cleanToken2 })

        // Fetch custom pair from backend
        const response = await fetch(
          `${config.api.baseUrl}/api/v1/streams/custom-pair`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token1: cleanToken1,
              token2: cleanToken2
            })
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Failed to fetch custom stream pair')
        }

        const streamPair = await response.json()
        console.log('Custom stream pair received:', streamPair)

        // Store the stream pair data in localStorage for the room
        if (streamPair.room_id) {
          const roomStreamData = {
            room_id: streamPair.room_id,
            stream_1: streamPair.stream_1,
            stream_2: streamPair.stream_2,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`room_streams_${streamPair.room_id}`, JSON.stringify(roomStreamData))

          // Also create/update the room on the backend
          await fetch(`${config.api.baseUrl}/api/v1/chat/room/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              room_id: streamPair.room_id,
              stream_1: streamPair.stream_1,
              stream_2: streamPair.stream_2
            })
          })

          // Redirect to main page with room parameter
          router.push(`/?room=${streamPair.room_id}`)
        } else {
          throw new Error('No room ID received from server')
        }

      } catch (err) {
        console.error('Error processing custom token pair:', err)
        setError(err instanceof Error ? err.message : 'Failed to process token pair')
        setLoading(false)

        // Redirect to home after showing error briefly
        setTimeout(() => {
          router.push('/')
        }, 3000)
      }
    }

    processTokens()
  }, [params.tokens, router])

  if (error) {
    return (
      <div className="h-screen bg-[#15161B] flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Error Loading Streams</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to home...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#15161B] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[#7DE2A1]" />
        <h2 className="text-xl font-semibold text-white mb-2">Loading Custom Streams</h2>
        <p className="text-gray-400">Fetching token data and creating room...</p>
      </div>
    </div>
  )
}