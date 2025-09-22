import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { config } from '@/lib/config'

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string
  username: string
  content: string
  timestamp: string
  is_system?: boolean
  profile_image?: string
  reply_to?: string
  reactions?: {
    likes: number
    users_liked: string[]
  }
}

interface WebSocketMessage {
  type: 'message' | 'system' | 'connection' | 'history' | 'error' | 'pong' | 'audio_summon' | 'audio_join_request' | 'streamer_ready'
  data?: ChatMessage | ChatMessage[] | AudioSummonData | AudioJoinRequest | StreamerReadyData
  message?: string
  status?: string
  room_id?: string
  user_count?: number
}

interface AudioSummonData {
  audio_room_id: string
  streamers: string[]
  message: string
}

interface AudioJoinRequest {
  audio_room_id: string
  join_url: string
  message: string
}

interface StreamerReadyData {
  room_id: string
  streamer_joined: string
  viewer_token: string
  audio_endpoint: string
  message: string
}

export function useWebSocket(roomId: string, streamPair?: any) {
  const { user, isWalletConnected } = useAuth()
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [userCount, setUserCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [audioSummon, setAudioSummon] = useState<AudioSummonData | null>(null)
  const [audioJoinRequest, setAudioJoinRequest] = useState<AudioJoinRequest | null>(null)
  const [streamerReady, setStreamerReady] = useState<StreamerReadyData | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const isConnecting = useRef(false)

  // Use refs for values that change frequently to avoid recreating the function
  const userRef = useRef(user)
  const isWalletConnectedRef = useRef(isWalletConnected)
  const streamPairRef = useRef(streamPair)

  // Update refs when values change
  useEffect(() => {
    userRef.current = user
    isWalletConnectedRef.current = isWalletConnected
    streamPairRef.current = streamPair
  }, [user, isWalletConnected, streamPair])

  const connect = useCallback(() => {
    if (!roomId || isConnecting.current) return

    // Prevent multiple simultaneous connections
    isConnecting.current = true

    try {
      // Build WebSocket URL with query parameters
      const wsUrl = new URL(`${config.websocket.url}/${roomId}`)

      // Use refs to get current values
      const currentUser = userRef.current
      const currentIsWalletConnected = isWalletConnectedRef.current
      const currentStreamPair = streamPairRef.current

      console.log('WebSocket connect - user:', currentUser, 'isWalletConnected:', currentIsWalletConnected)

      if (currentUser && currentIsWalletConnected && currentUser.wallet_address && !currentUser.wallet_address.startsWith('guest_')) {
        wsUrl.searchParams.set('user_id', currentUser.wallet_address)
        wsUrl.searchParams.set('username', currentUser.display_name || currentUser.username || currentUser.wallet_address.slice(0, 8))
        wsUrl.searchParams.set('profile_image', 'https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=93&img-dpr=2&img-onerror=redirect')
        console.log('Connecting as authenticated user:', currentUser.display_name || currentUser.username, 'with wallet:', currentUser.wallet_address)
      } else {
        // Guest user
        const guestName = `Guest_${Date.now().toString().slice(-6)}`
        wsUrl.searchParams.set('username', guestName)
        wsUrl.searchParams.set('profile_image', 'https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=93&img-dpr=2&img-onerror=redirect')
        console.log('Connecting as guest:', guestName, '- user:', currentUser, 'isWalletConnected:', currentIsWalletConnected)
      }

      // Add stream pair information if available
      // We send token addresses for identification, but full data should be managed server-side
      if (currentStreamPair && currentStreamPair.stream_1 && currentStreamPair.stream_2) {
        if (currentStreamPair.stream_1?.token_address) {
          wsUrl.searchParams.set('stream_1', currentStreamPair.stream_1.token_address)
        }
        if (currentStreamPair.stream_2?.token_address) {
          wsUrl.searchParams.set('stream_2', currentStreamPair.stream_2.token_address)
        }
        // Store full stream data in localStorage for this room
        if (typeof window !== 'undefined') {
          const roomStreamData = {
            room_id: roomId,
            stream_1: currentStreamPair.stream_1,
            stream_2: currentStreamPair.stream_2,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`room_streams_${roomId}`, JSON.stringify(roomStreamData))

          // Also store full stream data in backend
          if (currentStreamPair.room_id) {
            fetch(`${config.api.baseUrl}/api/v1/chat/room/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                room_id: currentStreamPair.room_id || roomId,
                stream_1: currentStreamPair.stream_1,
                stream_2: currentStreamPair.stream_2
              })
            }).then(response => {
              if (response.ok) {
                console.log('Stored full stream data in backend for room:', roomId)
              }
            }).catch(error => {
              console.error('Failed to store stream data in backend:', error)
            })
          }
        }
      } else {
        // No stream pair provided - joining existing room
        wsUrl.searchParams.set('stream_1', 'unknown')
        wsUrl.searchParams.set('stream_2', 'unknown')
      }

      console.log('Connecting to WebSocket:', wsUrl.toString())
      console.log('User info:', { user, isWalletConnected })

      const ws = new WebSocket(wsUrl.toString())

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttempts.current = 0
        isConnecting.current = false
      }

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data)
          console.log('WebSocket message received:', data)

          switch (data.type) {
            case 'connection':
              if (data.user_count !== undefined) {
                setUserCount(data.user_count)
              }
              break

            case 'history':
              if (Array.isArray(data.data)) {
                console.log('Received message history:', data.data.length, 'messages')
                setMessages(data.data as ChatMessage[])
              }
              break

            case 'message':
            case 'system':
              if (data.data && !Array.isArray(data.data)) {
                console.log('Received new message:', data.data)
                setMessages(prev => [...prev, data.data as ChatMessage])
              }
              break

            case 'error':
              console.error('WebSocket error:', data.message)
              // Check for rate limit error specifically
              if (data.message && (data.message.includes('Rate limit') || data.message.includes('rate limit'))) {
                setError('Rate limit exceeded. Please slow down.')
              } else {
                setError(data.message || 'Unknown error')
              }
              break

            case 'audio_summon':
              if (data.data) {
                console.log('Received audio summon:', data.data)
                setAudioSummon(data.data as AudioSummonData)
              }
              break

            case 'audio_join_request':
              if (data.data) {
                console.log('Received audio join request:', data.data)
                setAudioJoinRequest(data.data as AudioJoinRequest)
              }
              break

            case 'streamer_ready':
              if (data.data) {
                console.log('Received streamer ready notification:', data.data)
                setStreamerReady(data.data as StreamerReadyData)
              }
              break

            case 'pong':
              // Handle ping/pong for connection health
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = (event) => {
        isConnecting.current = false

        if (event.code !== 1000) {
          console.log('WebSocket closed unexpectedly:', event.code, event.reason)
        }
        setIsConnected(false)
        setSocket(null)

        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }

      ws.onerror = (event) => {
        // WebSocket errors don't provide much detail, connection issues will be handled by onclose
        isConnecting.current = false
        setError('Connection error')
      }

      setSocket(ws)
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to connect')
      isConnecting.current = false
    }
  }, [roomId])

  const disconnect = useCallback(() => {
    isConnecting.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.close(1000, 'User disconnected')
    }
    setSocket(null)
    setIsConnected(false)
    setMessages([])
    setUserCount(0)
  }, [socket])

  const sendMessage = useCallback((content: string, replyTo?: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, state:', socket?.readyState)
      setError('WebSocket not connected')
      return false
    }

    if (!content.trim()) {
      return false
    }

    try {
      const message = {
        type: 'message',
        content: content.trim(),
        reply_to: replyTo
      }
      console.log('Sending message:', message)
      socket.send(JSON.stringify(message))
      // Clear any previous error on successful send
      setError(null)
      return true
    } catch (err) {
      console.error('Failed to send message:', err)
      setError('Failed to send message')
      return false
    }
  }, [socket])

  const ping = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }))
    }
  }, [socket])

  // Track previous user state to detect authentication changes
  const prevUserRef = useRef<string | undefined>()
  const connectTimeoutRef = useRef<NodeJS.Timeout>()
  const hasInitializedRef = useRef(false)

  // Connect when hook is initialized or dependencies change
  useEffect(() => {
    if (!roomId || roomId === 'default') {
      return
    }

    const currentUserId = user?.wallet_address
    const prevUserId = prevUserRef.current

    console.log('WebSocket useEffect triggered - roomId:', roomId, 'currentUser:', currentUserId, 'prevUser:', prevUserId, 'connected:', isConnected)

    // Check if user authentication has changed
    const userChanged = prevUserId !== undefined && currentUserId !== prevUserId

    if (userChanged) {
      console.log('User authentication changed, will reconnect WebSocket')
      prevUserRef.current = currentUserId

      // Disconnect existing socket if any
      if (socket) {
        console.log('Disconnecting existing socket to reconnect with new user info')
        socket.close(1000, 'User authentication changed')
        setSocket(null)
        setIsConnected(false)
      }
    }

    // Only connect if we don't have an active connection
    if (!isConnected && !isConnecting.current) {
      // Clear any existing timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
      }

      // Connect after a small delay
      connectTimeoutRef.current = setTimeout(() => {
        if (!isConnected && !isConnecting.current) {
          console.log('Connecting WebSocket with user:', currentUserId || 'guest')
          connect()
        }
      }, hasInitializedRef.current ? 500 : 100) // Longer delay for reconnects

      hasInitializedRef.current = true
    }

    // Update the prev user ref
    if (prevUserId === undefined) {
      prevUserRef.current = currentUserId
    }

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.wallet_address, isWalletConnected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socket) {
        socket.close(1000, 'Component unmounted')
      }
    }
  }, [])

  // Ping periodically to keep connection alive
  useEffect(() => {
    if (isConnected) {
      const pingInterval = setInterval(ping, 30000) // Ping every 30 seconds
      return () => clearInterval(pingInterval)
    }
  }, [isConnected, ping])

  return {
    socket,
    messages,
    isConnected,
    userCount,
    error,
    audioSummon,
    audioJoinRequest,
    streamerReady,
    sendMessage,
    connect,
    disconnect,
    reconnect: connect
  }
}