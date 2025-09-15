import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'

export interface ChatMessage {
  id: string
  room_id: string
  user_id: string
  username: string
  content: string
  timestamp: string
  is_system?: boolean
}

interface WebSocketMessage {
  type: 'message' | 'system' | 'connection' | 'history' | 'error' | 'pong'
  data?: ChatMessage | ChatMessage[]
  message?: string
  status?: string
  room_id?: string
  user_count?: number
}

export function useWebSocket(roomId: string, streamPair?: any) {
  const { user, isWalletConnected } = useAuth()
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [userCount, setUserCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!roomId) return

    try {
      // Build WebSocket URL with query parameters
      const wsUrl = new URL(`ws://localhost:8000/api/v1/chat/ws/${roomId}`)

      if (user && isWalletConnected) {
        wsUrl.searchParams.set('user_id', user.wallet_address)
        wsUrl.searchParams.set('username', user.display_name || user.username || 'User')
      } else {
        // Guest user
        wsUrl.searchParams.set('username', `Guest_${Date.now().toString().slice(-6)}`)
      }

      // Add stream pair information if available
      if (streamPair) {
        if (streamPair.stream_1?.token_address) {
          wsUrl.searchParams.set('stream_1', streamPair.stream_1.token_address)
        }
        if (streamPair.stream_2?.token_address) {
          wsUrl.searchParams.set('stream_2', streamPair.stream_2.token_address)
        }
      }

      console.log('Connecting to WebSocket:', wsUrl.toString())

      const ws = new WebSocket(wsUrl.toString())

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setError(null)
        reconnectAttempts.current = 0
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
              setError(data.message || 'Unknown error')
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
        console.log('WebSocket closed:', event.code, event.reason)
        setIsConnected(false)
        setSocket(null)

        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket onerror event:', event)
        console.error('WebSocket readyState:', ws.readyState)
        console.error('WebSocket url:', wsUrl.toString())
        setError('Connection error')
      }

      setSocket(ws)
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      setError('Failed to connect')
    }
  }, [roomId, user, isWalletConnected, streamPair])

  const disconnect = useCallback(() => {
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

  const sendMessage = useCallback((content: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, state:', socket?.readyState)
      return false
    }

    if (!content.trim()) {
      return false
    }

    try {
      const message = {
        type: 'message',
        content: content.trim()
      }
      console.log('Sending message:', message)
      socket.send(JSON.stringify(message))
      return true
    } catch (err) {
      console.error('Failed to send message:', err)
      return false
    }
  }, [socket])

  const ping = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }))
    }
  }, [socket])

  // Connect when hook is initialized or dependencies change
  useEffect(() => {
    if (roomId) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [roomId])

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
    sendMessage,
    connect,
    disconnect,
    reconnect: connect
  }
}