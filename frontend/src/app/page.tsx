/**
 * PumpRoulette - Full functional pump.fun style
 */

'use client'

import { useState, useEffect } from 'react'
import { useStreamPair } from '@/hooks/useStreamPair'
import { config } from '@/lib/config'
import { useAuth } from '@/hooks/useAuth'
import { useWebSocket, type ChatMessage } from '@/hooks/useWebSocket'
import { useAudioSubscription } from '@/hooks/useAudioSubscription'
import { useToast } from '@/components/ui/use-toast'
import { LiveKitStream } from '@/components/LiveKitStream'
import AudioRoom from '@/components/AudioRoom'
import { ProgressBar } from '@/components/ProgressBar'
import { TalkView } from '@/components/TalkView'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Shuffle,
  Volume2,
  VolumeX,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Loader2,
  Users,
  Activity,
  Eye,
  Search,
  TrendingUp,
  X,
  Headphones
} from 'lucide-react'


export default function PumpRoulettePage() {
  const { streamPair, loading, error, fetchNewPair } = useStreamPair()
  const { user, connectWallet, logout, isConnecting, error: authError, isWalletConnected } = useAuth()
  useAudioSubscription()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Check for room and token parameters in URL
  const roomParam = searchParams.get('room')
  const tokenParam = searchParams.get('token')
  const roleParam = searchParams.get('role')

  // State declarations
  const [showTalkView, setShowTalkView] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [audioRoomToken, setAudioRoomToken] = useState<string | null>(null)
  const [audioRoomId, setAudioRoomId] = useState<string | null>(null)
  const [audioEndpoint, setAudioEndpoint] = useState<string>('')
  const [userRole, setUserRole] = useState<'streamer' | 'viewer' | 'moderator'>('viewer')
  const [viewerAudioEnabled, setViewerAudioEnabled] = useState(false)
  const [hasActiveAudio, setHasActiveAudio] = useState(false)
  const [streamerJoinPending, setStreamerJoinPending] = useState(false)
  const [audioRoomData, setAudioRoomData] = useState<{roomId: string, token?: string} | null>(null)
  const [audioParticipants, setAudioParticipants] = useState<{id: string, name: string, role: string}[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [streamMuted, setStreamMuted] = useState({ stream1: true, stream2: true })
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customRoomId, setCustomRoomId] = useState('')
  const [customStreamPair, setCustomStreamPair] = useState<any>(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

  // Use WebSocket for real-time chat
  const roomId = customRoomId || streamPair?.room_id || 'default'

  // Use custom stream pair if in custom room, otherwise use default
  // IMPORTANT: Don't fallback to random streamPair when in a custom room
  const currentStreamPair = customRoomId ? customStreamPair : streamPair

  const {
    messages: wsMessages,
    isConnected: chatConnected,
    userCount,
    sendMessage: sendChatMessage,
    error: chatError,
    audioSummon,
    audioJoinRequest,
    streamerReady
  } = useWebSocket(roomId, currentStreamPair)

  // Handle streamer ready notification
  useEffect(() => {
    if (streamerReady && userRole === 'viewer') {
      console.log('🎤 Streamer ready notification received:', streamerReady)

      // Check if this is for our current audio room
      if (streamerReady.room_id === audioRoomId) {
        console.log('🎤 Setting viewer token from streamer_ready notification')

        // Set the token and endpoint
        setAudioRoomToken(streamerReady.viewer_token)
        setAudioEndpoint(streamerReady.audio_endpoint || 'wss://pump-udxzob1q.livekit.cloud')

        // Auto-connect if we have the token
        if (streamerReady.viewer_token) {
          console.log('🎤 Auto-connecting viewer to audio room')
          setAudioEnabled(true)

          toast({
            title: "Streamer joined!",
            description: "Connecting to audio room...",
          })
        }
      }
    }
  }, [streamerReady, userRole, audioRoomId])

  // Check for active audio room when stream pair changes
  useEffect(() => {
    // Skip if TalkView is showing
    if (showTalkView) {
      return
    }

    const checkForActiveAudio = async () => {
      if (currentStreamPair?.room_id && !audioEnabled) {
        try {
          const response = await fetch(`${config.api.baseUrl}/api/v1/audio/stream/${currentStreamPair.room_id}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.participants && data.participants.length > 0) {
              setHasActiveAudio(true)
              console.log('Active audio room detected for this stream pair')
            } else {
              setHasActiveAudio(false)
            }
          } else {
            setHasActiveAudio(false)
          }
        } catch (error) {
          console.error('Failed to check for active audio:', error)
          setHasActiveAudio(false)
        }
      }
    }

    checkForActiveAudio()
  }, [currentStreamPair, audioEnabled, showTalkView])

  // Handle audio summon notifications
  useEffect(() => {
    if (audioSummon) {
      toast({
        title: "🔊 Audio Room Created",
        description: audioSummon.message
      })
    }
  }, [audioSummon, toast])

  // Handle audio join request for streamers
  useEffect(() => {
    if (audioJoinRequest && user) {
      // Check if current user is one of the streamers
      const isStreamer = currentStreamPair?.stream_1?.streamer_id === user.wallet_address ||
                        currentStreamPair?.stream_2?.streamer_id === user.wallet_address ||
                        currentStreamPair?.stream_1?.token_address === user.wallet_address ||
                        currentStreamPair?.stream_2?.token_address === user.wallet_address

      if (isStreamer) {
        // Set the audio room data and show join pending
        setAudioRoomData({
          roomId: audioJoinRequest.audio_room_id,
          token: audioJoinRequest.join_url.split('token=')[1]?.split('&')[0] || ''
        })
        setStreamerJoinPending(true)

        // Show notification
        toast({
          title: "📞 You've been summoned to audio!",
          description: "Click 'Join Voice' button to join the conversation",
        })
      }
    }
  }, [audioJoinRequest, user, currentStreamPair, toast])

  // Handle streamer ready notification - auto-connect viewers
  useEffect(() => {
    console.log('Streamer ready effect triggered:', {
      streamerReady,
      audioEnabled,
      audioRoomToken,
      showTalkView,
      userRole
    })

    // Check if we're waiting for a streamer (audioEnabled but no token)
    if (streamerReady && audioEnabled && !audioRoomToken && !showTalkView && userRole === 'viewer') {
      console.log('AUTO-CONNECTING: Streamer ready notification received:', streamerReady)

      // Auto-connect as viewer when streamer joins
      if (streamerReady.viewer_token && streamerReady.audio_endpoint) {
        console.log('Setting viewer token and connecting...')
        setViewerAudioEnabled(true)
        setAudioRoomToken(streamerReady.viewer_token)
        setAudioRoomId(streamerReady.room_id)
        setAudioEndpoint(streamerReady.audio_endpoint)
        setUserRole('viewer')
        setHasActiveAudio(true)

        toast({
          title: "🎤 Streamer joined!",
          description: "Automatically connecting you to the audio room.",
        })
      }
    }
  }, [streamerReady, audioEnabled, audioRoomToken, showTalkView, userRole, toast])

  useEffect(() => {
    // Only run once on mount
    let mounted = true

    // If room parameter exists, join that room
    if (roomParam && mounted) {
      console.log('Room parameter detected:', roomParam)

      // If role is provided (streamer_a or streamer_b), show wallet verification flow
      if (roleParam && (roleParam === 'streamer_a' || roleParam === 'streamer_b')) {
        console.log('Streamer role detected, showing wallet verification')
        setShowTalkView(true)
        setUserRole('streamer')  // Set role to streamer immediately
        setCustomRoomId(roomParam)

        // Load room data for streamer
        fetchRoomInfo(roomParam).then(roomData => {
          if (roomData && roomData.stream_pair) {
            setCustomStreamPair(roomData.stream_pair)
            console.log('Room data loaded for streamer:', roomData.stream_pair)
          }
        })
      } else {
        handleJoinRoom(roomParam)
      }
      // DON'T fetch new pair when joining a room!
    } else if (!customRoomId && mounted) {
      // Only fetch new pair if not in a custom room
      fetchNewPair()
    }

    // Force dark mode
    document.documentElement.classList.add('dark')

    return () => {
      mounted = false
    }
  }, [roomParam, tokenParam])

  // When streamPair changes (from fetchNewPair), create/update the room with full data
  useEffect(() => {
    if (streamPair && !customRoomId && streamPair.room_id) {
      // This is a random pair, create/update the room with full stream data
      const createRoomWithStreams = async () => {
        try {
          const response = await fetch(`${config.api.baseUrl}/api/v1/chat/room/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              room_id: streamPair.room_id, // Use the room_id from the stream pair
              stream_1: streamPair.stream_1,
              stream_2: streamPair.stream_2
            })
          })

          const data = await response.json()
          if (data.success) {
            console.log('Room created/updated with stream data:', data)
          }
        } catch (error) {
          console.error('Failed to create room with streams:', error)
        }
      }

      createRoomWithStreams()
    }
  }, [streamPair, customRoomId])

  // Show auth errors
  useEffect(() => {
    if (authError === 'wallet_not_found') {
      toast({
        title: "Phantom Wallet Required",
        description: "Please install Phantom wallet to connect.",
        variant: "destructive"
      })
    } else if (authError) {
      toast({
        title: "Authentication failed",
        description: authError,
        variant: "destructive"
      })
    }
  }, [authError, toast])

  // Debug: Monitor audio control state
  useEffect(() => {
    console.log('🎮 Control state updated:', {
      userRole,
      audioEnabled,
      showTalkView,
      roleParam,
      isWalletConnected,
      shouldShowControls: userRole === 'streamer' && audioEnabled
    })
  }, [userRole, audioEnabled, showTalkView, roleParam, isWalletConnected])

  // Auto-join audio when streamer connects wallet
  useEffect(() => {
    if (isWalletConnected && roleParam && (roleParam === 'streamer_a' || roleParam === 'streamer_b') && !audioEnabled && showTalkView) {
      console.log('Streamer wallet connected, auto-joining audio...')
      // Small delay to ensure everything is ready
      setTimeout(() => {
        handleJoinVoiceAsStreamer()
      }, 500)
    }
  }, [isWalletConnected, roleParam, audioEnabled, showTalkView])

  // Show chat errors
  useEffect(() => {
    if (chatError) {
      toast({
        title: "Chat connection error",
        description: chatError,
        variant: "destructive"
      })
    }
  }, [chatError, toast])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowProfileDropdown(false)
    }

    if (showProfileDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showProfileDropdown])

  const handleConnectWallet = () => {
    // Just try to connect wallet directly, no modal
    connectWallet()
  }

  const handleProfileClick = () => {
    if (isWalletConnected) {
      setShowProfileDropdown(!showProfileDropdown)
    } else {
      connectWallet()
    }
  }

  const fetchRoomInfo = async (roomId: string) => {
    console.log('fetchRoomInfo called for room:', roomId)
    try {
      // First check if we have stored stream data for this room
      if (typeof window !== 'undefined') {
        const storedData = localStorage.getItem(`room_streams_${roomId}`)
        console.log('localStorage data for room:', storedData ? 'Found' : 'Not found')
        if (storedData) {
          const roomData = JSON.parse(storedData)
          console.log('Using stored room stream data:', roomData)
          const fullStreamPair = {
            room_id: roomId,
            stream_1: roomData.stream_1,
            stream_2: roomData.stream_2
          }
          setCustomStreamPair(fullStreamPair)
          return { stream_pair: fullStreamPair, room_active: true }
        }
      }

      const response = await fetch(`${config.api.baseUrl}/api/v1/chat/room/${roomId}/info`)
      const data = await response.json()

      console.log('Room info response:', data)

      if (data.success) {
        if (data.stream_pair) {
          setCustomStreamPair(data.stream_pair)
          return { stream_pair: data.stream_pair, room_active: data.room_active }
        } else {
          // Room exists but no stream pair - DO NOT use current random stream pair
          setCustomStreamPair(null)
          return { stream_pair: null, room_active: data.room_active }
        }
      } else {
        // Room doesn't exist - this is correct behavior now
        console.error('Room not found:', data.error)
        setCustomStreamPair(null)
        return null
      }
    } catch (error) {
      console.error('Failed to fetch room info:', error)
      setCustomStreamPair(null)
      return null
    }
  }

  const handleJoinRoom = async (roomIdToJoin: string) => {
    console.log('handleJoinRoom called with:', roomIdToJoin)
    if (roomIdToJoin.trim()) {
      setLoadingRoom(true)

      // First, set the custom room ID
      setCustomRoomId(roomIdToJoin.trim())
      setSearchQuery('')

      // Clear any existing stream pair to prevent mixing with random streams
      setCustomStreamPair(null)
      console.log('Custom room ID set to:', roomIdToJoin.trim())

      toast({
        title: "Joining room",
        description: `Connecting to room: ${roomIdToJoin.slice(0, 8)}...`,
      })

      // Try to fetch stream pair for this room
      const roomData = await fetchRoomInfo(roomIdToJoin.trim())

      if (roomData && roomData.stream_pair && roomData.stream_pair.stream_1 && roomData.stream_pair.stream_2) {
        // We have full stream data for this room
        setCustomStreamPair(roomData.stream_pair)

        // Store the stream data for this room in localStorage
        if (typeof window !== 'undefined') {
          const roomStreamData = {
            room_id: roomIdToJoin.trim(),
            stream_1: roomData.stream_pair.stream_1,
            stream_2: roomData.stream_pair.stream_2,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`room_streams_${roomIdToJoin.trim()}`, JSON.stringify(roomStreamData))
        }

        toast({
          title: "Room joined",
          description: `Viewing ${roomData.stream_pair.stream_1?.symbol || roomData.stream_pair.stream_1?.token_name} vs ${roomData.stream_pair.stream_2?.symbol || roomData.stream_pair.stream_2?.token_name}`,
        })
      } else {
        // Room doesn't have stored stream data yet
        // Try to get it from active rooms list
        try {
          const roomsResponse = await fetch(`${config.api.baseUrl}/api/v1/chat/rooms`)
          const roomsData = await roomsResponse.json()

          if (roomsData.success && roomsData.rooms) {
            const targetRoom = roomsData.rooms.find((r: any) => r.room_id === roomIdToJoin.trim())
            if (targetRoom && targetRoom.stream_pair) {
              setCustomStreamPair(targetRoom.stream_pair)
              toast({
                title: "Room joined",
                description: `Found active room with streams`,
              })
            } else {
              toast({
                title: "Room joined",
                description: `Connected to room ${roomIdToJoin.slice(0, 8)}... No stream data available yet.`,
              })
            }
          }
        } catch (error) {
          console.error('Failed to fetch room list:', error)
          toast({
            title: "Room joined",
            description: `Connected to room ${roomIdToJoin.slice(0, 8)}...`,
          })
        }
      }

      setLoadingRoom(false)
    }
  }

  const handleBackToRandomRoom = () => {
    setCustomRoomId('')
    setCustomStreamPair(null)
    toast({
      title: "Back to random",
      description: "Returned to random stream pairs",
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      handleJoinRoom(searchQuery)
    }
  }


  const handleJoinAsListener = async () => {
    if (!currentStreamPair?.room_id) return

    console.log('🎧 handleJoinAsListener called with:', {
      room_id: currentStreamPair.room_id,
      api_url: `${config.api.baseUrl}/api/v1/audio/stream/${currentStreamPair.room_id}`
    })

    try {
      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/stream/${currentStreamPair.room_id}`)

      console.log('🌐 API Response:', {
        status: response.status,
        ok: response.ok,
        url: response.url
      })

      if (response.ok) {
        const data = await response.json()

        console.log('📊 API Success Data:', data)

        if (data.success && data.viewer_token) {
          // Extract room_id from token or use data.room_id if provided
          const actualRoomId = data.room_id || data.audio_room_id || currentStreamPair.room_id

          console.log('🎯 Setting viewer audio state:', {
            viewer_token: data.viewer_token.substring(0, 50) + '...',
            room_id: actualRoomId,
            endpoint: 'wss://pump-udxzob1q.livekit.cloud',
            data_room_id: data.room_id,
            data_audio_room_id: data.audio_room_id,
            stream_pair_room_id: currentStreamPair.room_id
          })

          // Batch all state updates to prevent multiple renders
          setAudioEndpoint('wss://pump-udxzob1q.livekit.cloud')
          setUserRole('viewer')
          setAudioRoomId(actualRoomId) // Use the actual room_id from backend
          setAudioRoomToken(data.viewer_token)
          setViewerAudioEnabled(true) // Enable audio last to trigger single render
          toast({
            title: "Joined audio",
            description: "You can now hear the conversation",
          })
        } else {
          throw new Error('No audio stream available')
        }
      } else if (response.status === 425) {
        // Handle "Too Early" - streamers haven't joined yet
        toast({
          title: "Streamers not ready",
          description: "Waiting for streamers to join. Please try again in a moment.",
          variant: "destructive",
        })
        return
      } else {
        const errorText = await response.text()
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(`Failed to get viewer token: ${response.status}`)
      }
    } catch (error) {
      console.error('❌ Failed to join as listener:', error)
      toast({
        title: "Failed to join audio",
        description: "No active audio room for this stream pair",
        variant: "destructive"
      })
    }
  }


  const handleJoinVoiceAsStreamer = async () => {
    if (!audioRoomData || !audioRoomData.token) {
      toast({
        title: "No audio room available",
        description: "Waiting for audio room setup.",
        variant: "destructive"
      })
      return
    }

    try {
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop()) // Stop the test stream

      // Extract role from token URL params
      const tokenParams = new URLSearchParams(audioRoomData.token.split('?')[1] || '')
      const role = tokenParams.get('role') || 'streamer_a'

      console.log('Verifying streamer with role:', role, 'room:', audioRoomData.roomId)

      // Verify with backend that streamer is joining
      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/room/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_id: audioRoomData.roomId,
          role: role,
          token: audioRoomData.token.split('token=')[1]?.split('&')[0] || audioRoomData.token
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Room verify response:', data)

        // Now join the audio room
        setAudioEnabled(true)
        setAudioRoomToken(data.streamer_token || audioRoomData.token)
        setAudioRoomId(audioRoomData.roomId)
        setAudioEndpoint(data.audio_endpoint || 'wss://pump-udxzob1q.livekit.cloud')
        setUserRole('streamer')
        setStreamerJoinPending(false)

        toast({
          title: "Joined audio room",
          description: "You can now speak with other participants.",
        })
      } else {
        throw new Error('Failed to verify room')
      }
    } catch (error) {
      console.error('Failed to join audio:', error)
      toast({
        title: "Failed to join audio",
        description: "Please check your microphone permissions.",
        variant: "destructive"
      })
    }
  }

  const handleSummonStreamers = async () => {
    if (!currentStreamPair) return

    if (!isWalletConnected) {
      toast({
        title: "Wallet required",
        description: "Please connect your wallet to create audio rooms.",
        variant: "destructive"
      })
      return
    }

    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/summon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          stream_pair_id: currentStreamPair.room_id,
          streamer_a_id: currentStreamPair.stream_1?.streamer_id || currentStreamPair.stream_1?.token_address || 'streamer_a',
          streamer_b_id: currentStreamPair.stream_2?.streamer_id || currentStreamPair.stream_2?.token_address || 'streamer_b',
          stream_1_mint: currentStreamPair.stream_1?.token_address,
          stream_2_mint: currentStreamPair.stream_2?.token_address
        })
      })

      if (response.ok) {
        const data = await response.json()

        // Debug logging to see what backend returns
        console.log("🔍 SUMMON RESPONSE FROM BACKEND:", data)
        console.log("🔍 audio_endpoint value:", data.audio_endpoint)
        console.log("🔍 room_token:", data.room_token ? 'exists' : 'missing')
        console.log("🔍 room_id:", data.room_id)

        // Don't set the token yet - wait for streamer to join
        setAudioEnabled(true)
        // setAudioRoomToken(data.room_token) // DON'T SET TOKEN YET - wait for streamer_ready
        setAudioRoomId(data.room_id)

        // Log what we're setting for audioEndpoint
        const endpoint = data.audio_endpoint || 'wss://pump-udxzob1q.livekit.cloud'
        console.log("🔍 Setting audioEndpoint to:", endpoint)
        setAudioEndpoint(endpoint)

        setUserRole('viewer') // The person who summons is a listener/viewer
        setHasActiveAudio(true)

        // Log the streamer links for testing
        console.log("🎤 AUDIO ROOM CREATED - STREAMER LINKS:")
        console.log("Streamer A:", data.streamer_a_url)
        console.log("Streamer B:", data.streamer_b_url)

        toast({
          title: "Audio room created",
          description: "Waiting for streamers to join...",
        })
      } else {
        throw new Error('Failed to create audio room')
      }
    } catch (error) {
      console.error('Failed to summon streamers:', error)
      toast({
        title: "Failed to create audio room",
        description: "Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleNextPair = async () => {
    setAudioEnabled(false)
    setMicEnabled(false)
    setAudioRoomToken(null)
    setAudioRoomId(null)
    setHasActiveAudio(false)
    setAudioParticipants([])
    setCustomRoomId('') // Clear custom room
    setCustomStreamPair(null) // Clear custom stream pair
    await fetchNewPair()

    // After fetching new pair, store it in the backend for the room
    // This will be done when WebSocket connects with stream data
  }

  const sendMessage = () => {
    if (newMessage.trim() && chatConnected) {
      const success = sendChatMessage(newMessage.trim(), replyingTo?.id)
      if (success) {
        setNewMessage('')
        setReplyingTo(null) // Clear reply state after sending
      } else {
        toast({
          title: "Failed to send message",
          description: "Please check your connection and try again.",
          variant: "destructive"
        })
      }
    }
  }


  return (
    <div className="h-screen bg-[#15161B] text-white flex flex-col overflow-hidden">
      <ProgressBar isLoading={loading} />
      {/* Header - pump.fun style */}
      <header className="h-14 bg-[#181821] border-b border-[#25262b] flex-shrink-0">
        <div className="h-full px-2 sm:px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6 flex-1">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Pump Roulette"
                className="w-7 sm:w-9 h-auto"
              />
              <div className="flex items-center" style={{
                fontSize: '22px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                letterSpacing: '0.5px'
              }}>
                <span style={{
                  fontWeight: 300,
                  color: '#ffffff'
                }}>Pump</span>
                <span style={{
                  fontWeight: 600,
                  marginLeft: '2px',
                  color: '#ffffff'
                }}>Roulette</span>
              </div>
            </div>

            {/* Room Search Bar - Desktop */}
            <div className="hidden sm:block flex-1 flex justify-center">
              <div className="w-64">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter Room ID"
                    className="w-full h-7 pl-8 pr-14 bg-[#15161B] border border-[#2E3036] rounded-sm text-xs text-white placeholder:text-gray-500 focus:border-white/50 focus:outline-none transition-colors"
                  />
                  {searchQuery.trim() && (
                    <button
                      type="submit"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 px-2 h-5 bg-white hover:bg-gray-100 text-black rounded-sm text-xs font-medium transition-colors flex items-center"
                    >
                      Join
                    </button>
                  )}
                </form>
              </div>
            </div>

            {/* Mobile Search Button */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="sm:hidden p-1.5 bg-[#25262b] hover:bg-[#2a2b30] rounded-sm transition-colors"
            >
              {showMobileSearch ? <X className="h-4 w-4 text-gray-400" /> : <Search className="h-4 w-4 text-gray-400" />}
            </button>

          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {customRoomId ? (
              <button
                onClick={handleBackToRandomRoom}
                className="h-7 px-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-sm text-xs flex items-center justify-center gap-1.5 transition-all min-w-[90px]"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>Back to Random</span>
              </button>
            ) : (
              <button
                onClick={handleNextPair}
                disabled={loading}
                className="h-7 px-3 bg-[#83EFAA] hover:bg-[#73df9a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-sm text-xs flex items-center justify-center gap-1.5 transition-all min-w-[90px]"
              >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Finding...</span>
                </>
              ) : (
                <>
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>Next Pair</span>
                </>
              )}
            </button>
            )}

            <button
              onClick={() => router.push('/rooms')}
              className="h-7 px-3 bg-[#25262b] hover:bg-[#2a2b30] text-white rounded-sm text-xs font-medium transition-colors flex items-center justify-center gap-1.5 min-w-[90px]"
            >
              <Users className="h-3.5 w-3.5" />
              <span>View Rooms</span>
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleProfileClick()
                }}
                disabled={isConnecting}
                className="h-7 px-3 bg-[#25262b] hover:bg-[#2a2b30] disabled:opacity-50 text-white border border-[#2a2b30] rounded-sm text-xs font-medium transition-all flex items-center justify-center gap-1.5 min-w-[90px]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>...</span>
                  </>
                ) : user && isWalletConnected ? (
                  <>
                    <img
                      src="https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=32&img-dpr=2&img-onerror=redirect"
                      alt={user.display_name}
                      className="w-4 h-4 rounded-full"
                    />
                    <span className="text-xs truncate max-w-[60px]">{(user.display_name || user.username || '').slice(0, 8)}</span>
                    {user.is_verified && (
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                    )}
                    <svg className="w-3 h-3 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                ) : (
                  'Login'
                )}
              </button>

              {/* Profile Dropdown */}
              {showProfileDropdown && user && isWalletConnected && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-[#1e1f26] border border-[#2a2b35] rounded-md shadow-xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* User Info Header */}
                  <div className="px-3 py-2 border-b border-[#2a2b35]">
                    <div className="flex items-center gap-2">
                      <img
                        src="https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=24&img-dpr=2&img-onerror=redirect"
                        alt={user.display_name}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-xs truncate">
                          {user.display_name || user.username || user.wallet_address.slice(0, 6) + '...'}
                        </div>
                      </div>
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => router.push('/profile')}
                      className="w-full px-3 py-1.5 text-left text-gray-300 hover:bg-[#2a2b35] text-xs transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Profile
                    </button>
                    <button
                      onClick={() => window.open(`https://solscan.io/account/${user.wallet_address}`, '_blank')}
                      className="w-full px-3 py-1.5 text-left text-gray-300 hover:bg-[#2a2b35] text-xs transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      View Wallet
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(user.wallet_address)
                        toast({
                          title: "Address copied",
                          description: "Wallet address copied to clipboard",
                        })
                      }}
                      className="w-full px-3 py-1.5 text-left text-gray-300 hover:bg-[#2a2b35] text-xs transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy address
                    </button>
                  </div>

                  <div className="border-t border-[#2a2b35]">
                    <button
                      onClick={logout}
                      className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-[#2a2b35] text-xs transition-colors flex items-center gap-2"
                    >
                      <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="sm:hidden bg-[#181821] border-b border-[#25262b] p-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Room ID to join"
              className="w-full h-8 pl-9 pr-16 bg-[#15161B] border border-[#2E3036] rounded-sm text-sm text-white placeholder:text-gray-500 focus:border-white/50 focus:outline-none transition-colors"
            />
            {searchQuery.trim() && (
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-[#7DE2A1] hover:bg-[#6dd291] text-black rounded-sm text-xs font-medium transition-colors"
              >
                Join
              </button>
            )}
          </form>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Streams */}
        <div className="flex-1 flex flex-col bg-[#15161B] min-h-0">
          {/* Control Bar */}
          <div className="border-b border-[#25262b] px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#181821] gap-2">
            <div className="flex items-center gap-3">
              {/* Show audio status for summon creator (listener) */}
              {userRole === 'viewer' && audioEnabled && !tokenParam && (
                <div className="flex items-center gap-2">
                  {audioParticipants.length > 0 ? (
                    <>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <Headphones className="w-4 h-4" />
                        <span className="text-xs">Listening</span>
                      </div>
                      <span className="text-xs text-green-400">{audioParticipants.length} streamer{audioParticipants.length > 1 ? 's' : ''} active</span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {audioRoomToken ? 'Streamers ready - click Listen to join!' : 'Waiting for streamers to join...'}
                    </span>
                  )}
                </div>
              )}
              {/* Show Join Voice button if user is a streamer and has been summoned */}
              {streamerJoinPending && !audioEnabled && (
                <button
                  onClick={handleJoinVoiceAsStreamer}
                  className="px-2 py-1 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 animate-pulse"
                >
                  <Mic className="h-4 w-4" />
                  <span>Join Voice</span>
                </button>
              )}

              {/* Streamer audio controls */}
              {userRole === 'streamer' && audioEnabled && (
                <>
                  <div className="px-2 py-1 bg-red-500 rounded text-white font-semibold animate-pulse text-xs">
                    LIVE
                  </div>
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    className={`px-2 py-1 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 ${
                      !micEnabled
                        ? 'bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]'
                    }`}
                  >
                    {!micEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    <span className="hidden sm:inline">{!micEnabled ? 'Unmute' : 'Mute'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setAudioEnabled(false)
                      window.location.href = '/'
                    }}
                    className="px-2 py-1 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Leave</span>
                  </button>
                </>
              )}

              {/* Summon Streamers button - only show for non-streamers when not in audio and no active audio */}
              {!tokenParam && !audioEnabled && userRole !== 'streamer' && !hasActiveAudio && !showTalkView && roleParam !== 'streamer_a' && roleParam !== 'streamer_b' && (
                <button
                  onClick={handleSummonStreamers}
                  disabled={!isWalletConnected}
                  className={`px-2 py-1 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !isWalletConnected
                      ? 'bg-[#25262b] text-gray-600 border border-[#2a2b30] cursor-not-allowed opacity-50'
                      : 'bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]'
                  }`}
                  title={!isWalletConnected ? 'Connect wallet to create audio rooms' : ''}
                >
                  <Mic className="h-4 w-4" />
                  <span className="hidden sm:inline">Summon Streamers</span>
                  <span className="sm:hidden">Summon</span>
                </button>
              )}
              {/* End Call button for summon creator */}
              {userRole === 'viewer' && audioEnabled && !tokenParam && (
                <button
                  onClick={() => {
                    setAudioEnabled(false)
                    setAudioRoomToken(null)
                    setAudioRoomId(null)
                  }}
                  className="px-2 py-0.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1 bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  <span className="text-[11px]">End Call</span>
                </button>
              )}

              {/* Listen to Conversation button - styled like Summon Streamers */}
              {hasActiveAudio && !audioEnabled && !viewerAudioEnabled && userRole === 'viewer' && (
                <button
                  onClick={handleJoinAsListener}
                  className="px-2 py-0.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1 bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Listen to Conversation</span>
                </button>
              )}

              {/* Stop Listening button */}
              {viewerAudioEnabled && (
                <button
                  onClick={() => {
                    setViewerAudioEnabled(false)
                    setAudioRoomToken(null)
                    setAudioRoomId(null)
                    toast({
                      title: "Left audio",
                      description: "No longer listening to the conversation",
                    })
                  }}
                  className="px-2 py-0.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1 bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 border border-[#2a2b30]"
                >
                  <VolumeX className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Stop Listening</span>
                </button>
              )}

              {!isWalletConnected && !hasActiveAudio && (
                <div className="hidden sm:block px-2 py-1 text-xs text-gray-500 bg-[#25262b]/50 rounded-sm border border-[#2a2b30]">
                  Connect wallet for audio features
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1 sm:gap-1.5 text-gray-400">
                <Eye className="h-3 sm:h-4 w-3 sm:w-4" />
                <span>{currentStreamPair ? currentStreamPair.stream_1.viewer_count + currentStreamPair.stream_2.viewer_count : 0}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 text-gray-400">
                <Users className="h-3 sm:h-4 w-3 sm:w-4" />
                <span className="hidden sm:inline">{userCount || 0} active</span>
                <span className="sm:hidden">{userCount || 0}</span>
              </div>
            </div>
          </div>

          {/* Streams Container */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-[#55d292] mx-auto mb-4" />
                  <p className="text-[#9ca3af]">Finding random streams...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={fetchNewPair}
                    className="px-3 py-1.5 bg-[#83EFAA] hover:bg-[#73df9a] text-black font-bold rounded-sm"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : loadingRoom ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                  <p className="text-gray-400">Loading room streams...</p>
                </div>
              </div>
            ) : currentStreamPair || (tokenParam && roleParam) ? (
              <div className="flex-1 flex flex-col">
                {/* Stream 1 */}
                <div className="flex-1 flex border-b border-[#25262b] relative">
                  {currentStreamPair?.stream_1 ? (
                    <LiveKitStream
                      stream={currentStreamPair.stream_1}
                      streamId="stream1"
                      muted={streamMuted.stream1}
                      onMuteChange={(muted) => setStreamMuted(prev => ({ ...prev, stream1: muted }))}
                    />
                  ) : (
                    <div className="flex-1 bg-[#181821] flex items-center justify-center">
                      <p className="text-gray-500 text-sm">Waiting for stream...</p>
                    </div>
                  )}

                  {/* TalkView overlay for streamer_a */}
                  {showTalkView && roleParam === 'streamer_a' && (
                    <TalkView
                      roomId={roomParam || ''}
                      role="streamer_a"
                      onClose={() => {
                        setShowTalkView(false)
                        // Clear URL params
                        router.push('/')
                      }}
                      onAudioEnabled={(enabled, token, roomId, endpoint) => {
                        console.log('🎤 TalkView audio enabled callback:', { enabled, token, roomId, endpoint })
                        setAudioEnabled(enabled)
                        setAudioRoomToken(token)
                        setAudioRoomId(roomId)
                        setAudioEndpoint(endpoint)
                        setUserRole('streamer')
                        setMicEnabled(true)
                        console.log('🎤 States set:', { audioEnabled: enabled, userRole: 'streamer', micEnabled: true })
                      }}
                      isMuted={!micEnabled}
                      onMuteChange={(muted) => {
                        console.log('🎤 TalkView (streamer_a) mute changed:', muted)
                        setMicEnabled(!muted)
                      }}
                    />
                  )}
                </div>

                {/* Stream 2 */}
                <div className="flex-1 flex relative">
                  {currentStreamPair?.stream_2 ? (
                    <LiveKitStream
                      stream={currentStreamPair.stream_2}
                      streamId="stream2"
                      muted={streamMuted.stream2}
                      onMuteChange={(muted) => setStreamMuted(prev => ({ ...prev, stream2: muted }))}
                    />
                  ) : (
                    <div className="flex-1 bg-[#181821] flex items-center justify-center">
                      <p className="text-gray-500 text-sm">Waiting for stream...</p>
                    </div>
                  )}

                  {/* TalkView overlay for streamer_b */}
                  {showTalkView && roleParam === 'streamer_b' && (
                    <TalkView
                      roomId={roomParam || ''}
                      role="streamer_b"
                      onClose={() => {
                        setShowTalkView(false)
                        // Clear URL params
                        router.push('/')
                      }}
                      onAudioEnabled={(enabled, token, roomId, endpoint) => {
                        console.log('🎤 TalkView audio enabled callback:', { enabled, token, roomId, endpoint })
                        setAudioEnabled(enabled)
                        setAudioRoomToken(token)
                        setAudioRoomId(roomId)
                        setAudioEndpoint(endpoint)
                        setUserRole('streamer')
                        setMicEnabled(true)
                        console.log('🎤 States set:', { audioEnabled: enabled, userRole: 'streamer', micEnabled: true })
                      }}
                      isMuted={!micEnabled}
                      onMuteChange={(muted) => {
                        console.log('🎤 TalkView (streamer_b) mute changed:', muted)
                        setMicEnabled(!muted)
                      }}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Chat - pump.fun style */}
        <div className="w-full lg:w-[400px] border-t lg:border-t-0 lg:border-l border-[#25262b] bg-[#181821] flex flex-col h-64 lg:h-auto">
          {/* Chat Header */}
          <div className="px-2 sm:px-4 py-2 sm:py-3 border-b border-[#25262b] bg-[#181821]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-white">Chat</span>
              <span className="text-xs text-gray-500">
                {wsMessages.length} messages
              </span>
            </div>
          </div>

          {/* Audio Room */}
          {(() => {
            const shouldRender = (audioEnabled || viewerAudioEnabled) && audioRoomToken && audioRoomId && audioEndpoint;
            console.log('AudioRoom render check:', {
              audioEnabled,
              viewerAudioEnabled,
              hasToken: !!audioRoomToken,
              hasRoomId: !!audioRoomId,
              hasEndpoint: !!audioEndpoint,
              shouldRender
            });
            return null;
          })()}
          {/* Only render AudioRoom if NOT using TalkView (TalkView manages its own connection) */}
          {((audioEnabled || viewerAudioEnabled) && audioRoomToken && audioRoomId && audioEndpoint && !showTalkView) && (
            <div className="border-b border-[#25262b]">
              {(() => {
                console.log("🎯 RENDERING AUDIOROOM WITH:", {
                  roomId: audioRoomId,
                  token: audioRoomToken ? 'exists' : 'missing',
                  role: userRole,
                  livekitUrl: audioEndpoint
                })
                return null
              })()}
              <AudioRoom
                roomId={audioRoomId}
                token={audioRoomToken}
                role={userRole}
                livekitUrl={audioEndpoint}
                onParticipantsChange={(participants: any[]) => {
                  // Update participants list for status display
                  const streamers = participants.filter(p => p.metadata?.role === 'streamer' || p.role === 'streamer')
                  setAudioParticipants(streamers.map(p => ({
                    id: p.id || p.identity,
                    name: p.name || p.identity?.slice(0, 8),
                    role: p.metadata?.role || 'streamer'
                  })))
                }}
                onDisconnect={() => {
                  console.log('⚠️ AudioRoom disconnected:', { role: userRole })
                  if (userRole === 'streamer') {
                    setAudioEnabled(false)
                  } else {
                    setViewerAudioEnabled(false)
                  }
                  setAudioRoomToken(null)
                  setAudioRoomId(null)
                  setAudioParticipants([])
                  toast({
                    title: "Audio disconnected",
                    description: userRole === 'streamer' ? "Left the audio room" : "Stopped listening",
                  })
                }}
              />
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 min-h-0">
            {wsMessages.map((msg) => (
              <div key={msg.id} className={`flex items-start gap-2.5 py-1 hover:bg-[#25262b]/30 rounded px-1 transition-colors group ${msg.is_system ? 'justify-center' : ''}`}>
                {!msg.is_system && (
                  <div className="relative">
                    <img
                      src={msg.profile_image || `https://ui-avatars.com/api/?name=${msg.username}&background=666&color=fff&size=64&rounded=true`}
                      alt={msg.username}
                      className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 border border-[#25262b] group-hover:border-[#7DE2A1] transition-colors"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = `https://ui-avatars.com/api/?name=${msg.username}&background=666&color=fff&size=64&rounded=true`
                      }}
                    />
                    {/* Wallet connected indicator for real users */}
                    {msg.user_id !== 'system' && !msg.user_id.startsWith('guest_') && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white rounded-full border border-[#181821] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                      </div>
                    )}
                  </div>
                )}
                <div className={`flex-1 min-w-0 ${msg.is_system ? 'text-center' : ''}`}>
                  {msg.is_system ? (
                    <div className="text-xs text-gray-400 italic">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold flex items-center gap-1">
                          {msg.username}
                          {/* Verified badge for current user */}
                          {user && msg.user_id === user.wallet_address && user.is_verified && (
                            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                          {/* Premium badge */}
                          {user && msg.user_id === user.wallet_address && user.is_premium && (
                            <span className="text-xs px-1 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-white font-bold">
                              PRO
                            </span>
                          )}
                        </span>
                        <span className="text-[#9ca3af] text-xs">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {/* Wallet address tooltip for current user */}
                        {user && msg.user_id === user.wallet_address && (
                          <span className="text-[#9ca3af] text-xs font-mono opacity-60">
                            {user.wallet_address.slice(0, 4)}...{user.wallet_address.slice(-4)}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm break-words mt-0.5">{msg.content}</p>
                      {/* Message reactions/actions for wallet users */}
                      {isWalletConnected && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-2">
                          <button
                            onClick={() => setReplyingTo(msg)}
                            className="text-xs text-gray-500 hover:text-white transition-colors"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => {
                              // TODO: Implement like functionality
                              console.log('Like message:', msg.id)
                            }}
                            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                          >
                            ❤️ {msg.reactions?.likes || 0}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {wsMessages.length === 0 && (
              <div className="text-center py-12">
                <div className="mb-3">
                  <Users className="h-8 w-8 text-gray-600 mx-auto" />
                </div>
                <p className="text-gray-500 text-sm mb-1">No messages yet</p>
                <p className="text-gray-600 text-xs">Be the first to start the conversation!</p>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-2 sm:p-3 border-t border-[#25262b] bg-[#181821]">
            {isWalletConnected ? (
              <>
                {/* Wallet user input with enhanced features */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=93&img-dpr=2&img-onerror=redirect"
                      alt={user?.display_name}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-xs text-gray-400">
                      Chatting as {user?.display_name}
                      {user?.is_verified && <span className="text-white ml-1">✓</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${chatConnected ? 'bg-white' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-500">
                      {chatConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                {/* Reply indicator */}
                {replyingTo && (
                  <div className="mb-2 px-3 py-2 bg-[#25262b] rounded-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Replying to</span>
                      <span className="text-xs text-white font-medium">{replyingTo.username}</span>
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">
                        {replyingTo.content}
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendMessage()
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={chatConnected ? "Share your thoughts on these tokens..." : "Connecting to chat..."}
                    disabled={!chatConnected}
                    className="flex-1 px-3 py-1.5 bg-[#15161B] border border-[#2E3036] rounded-sm text-sm text-white placeholder:text-gray-500 focus:border-white/50 focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || !chatConnected}
                    className="px-2.5 py-1.5 bg-[#83EFAA] hover:bg-[#73df9a] disabled:opacity-50 text-black rounded-sm font-medium transition-all"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Login required for chat */}
                <div className="text-center py-6">
                  <div className="mb-3">
                    <div className="w-12 h-12 bg-[#25262b] rounded-full flex items-center justify-center mx-auto mb-3">
                      <Send className="h-5 w-5 text-gray-500" />
                    </div>
                    <p className="text-white font-medium mb-1">Join the conversation</p>
                    <p className="text-xs text-gray-500 mb-4">
                      Connect your wallet to chat with other traders
                    </p>
                    <button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 text-black font-semibold rounded-sm transition-colors"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer with live stats */}
      <footer className="h-10 bg-[#181821] border-t border-[#25262b] flex-shrink-0">
        <div className="h-full px-2 sm:px-4 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-3 sm:gap-6 text-xs flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400">
                Room: <span className="text-white font-mono">{roomId.slice(0, 8)}</span>
                {customRoomId && (
                  <span className="ml-1 bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[10px]">
                    Custom
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-gray-400">
                <span className="text-white font-medium">{currentStreamPair ? currentStreamPair.stream_1.viewer_count + currentStreamPair.stream_2.viewer_count : 0}</span> viewers
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-white" />
              <span className="text-gray-400">
                <span className="text-white font-medium">2</span> streams
              </span>
            </div>
            {currentStreamPair && currentStreamPair.stream_1.usd_market_cap && currentStreamPair.stream_2.usd_market_cap && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-gray-400">
                  Combined MCap: <span className="text-white font-medium">
                    ${((currentStreamPair.stream_1.usd_market_cap + currentStreamPair.stream_2.usd_market_cap) / 1000000).toFixed(2)}M
                  </span>
                </span>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs">
            {currentStreamPair && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Stream 1:</span>
                  <span className="text-white font-medium">{currentStreamPair.stream_1.symbol || currentStreamPair.stream_1.token_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Stream 2:</span>
                  <span className="text-white font-medium">{currentStreamPair.stream_2.symbol || currentStreamPair.stream_2.token_name}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </footer>

    </div>
  )
}