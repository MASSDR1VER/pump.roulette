/**
 * PumpRoulette - Full-screen experimental layout
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'
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
  X,
  Headphones,
  Heart,
  MessageSquare,
  UserPlus,
  UserCheck,
  AtSign,
  MessageCircle,
  ChevronRight,
  Radio,
  User,
  Edit2,
  Camera
} from 'lucide-react'


export default function PumpRoulettePage() {
  const { streamPair, loading, error, fetchNewPair } = useStreamPair()
  const { user, connectWallet, logout, isConnecting, error: authError, isWalletConnected } = useAuth()
  useAudioSubscription()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [streamTokens, setStreamTokens] = useState<{ stream1?: string; stream2?: string }>({})
  const [fetchingTokens, setFetchingTokens] = useState(false)

  // Check for room and token parameters in URL
  const roomParam = searchParams.get('room')
  const tokenParam = searchParams.get('token')
  const roleParam = searchParams.get('role')

  const [showTalkView, setShowTalkView] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [audioRoomToken, setAudioRoomToken] = useState<string | null>(null)
  const [audioRoomId, setAudioRoomId] = useState<string | null>(null)
  const [audioEndpoint, setAudioEndpoint] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'viewer' | 'streamer'>('viewer')
  const [micEnabled, setMicEnabled] = useState(true)
  const [viewerAudioEnabled, setViewerAudioEnabled] = useState(false)
  const [hasActiveAudio, setHasActiveAudio] = useState(false)
  const [audioParticipants, setAudioParticipants] = useState<any[]>([])
  const [streamerJoinPending, setStreamerJoinPending] = useState(false)

  const [streamMuted, setStreamMuted] = useState({ stream1: false, stream2: false })
  const [newMessage, setNewMessage] = useState('')
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customRoomId, setCustomRoomId] = useState('')
  const [customStreamPair, setCustomStreamPair] = useState<any>(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [loadingRoom, setLoadingRoom] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showUserProfile, setShowUserProfile] = useState(false)
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set())
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [mentionSearch, setMentionSearch] = useState('')
  const [showMentionsList, setShowMentionsList] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [summonPending, setSummonPending] = useState(false)
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 })
  const [chatSize, setChatSize] = useState({ width: 320, height: 400 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ width: 0, height: 0, x: 0, y: 0 })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editedProfile, setEditedProfile] = useState({
    username: '',
    bio: '',
    profile_image: ''
  })
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Use WebSocket for real-time chat
  const roomId = customRoomId || streamPair?.room_id || 'default'

  // Use custom stream pair if in custom room, otherwise use default
  // IMPORTANT: Don't fallback to random streamPair when in a custom room
  const currentStreamPair = customRoomId ? customStreamPair : streamPair

  // Debug logging
  useEffect(() => {
    console.log('Stream pair debug:', {
      streamPair,
      customRoomId,
      customStreamPair,
      currentStreamPair,
      hasStream1: !!currentStreamPair?.stream_1,
      hasStream2: !!currentStreamPair?.stream_2,
      stream1Data: currentStreamPair?.stream_1,
      stream2Data: currentStreamPair?.stream_2,
      loading,
      error
    })
  }, [streamPair, customRoomId, customStreamPair, currentStreamPair, loading, error])

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

      // Update audio room info
      setAudioRoomToken(streamerReady.viewer_token)
      setAudioRoomId(streamerReady.room_id)
      setAudioEndpoint(streamerReady.audio_endpoint || 'wss://pump-udxzob1q.livekit.cloud')
      setHasActiveAudio(true)

      // Show toast notification
      toast({
        title: "Streamer joined!",
        description: `${streamerReady.streamer_joined} is ready to talk. Click "Listen to Conversation" to join.`,
      })
    }
  }, [streamerReady, userRole, toast])

  // Handle audio join request (for streamers)
  useEffect(() => {
    if (audioJoinRequest) {
      console.log('🎧 Audio join request received:', audioJoinRequest)
      // Show streamer join pending state
      setStreamerJoinPending(true)
      toast({
        title: "Audio Room Invite",
        description: audioJoinRequest.message || "You've been invited to join an audio room",
      })
    }
  }, [audioJoinRequest, toast])

  // Debug: Monitor audio control state
  useEffect(() => {
    console.log('🎧 Audio Control State:', {
      audioEnabled,
      viewerAudioEnabled,
      audioRoomToken: !!audioRoomToken,
      audioRoomId,
      audioEndpoint,
      userRole,
      hasActiveAudio,
      audioParticipants: audioParticipants.length
    })
  }, [audioEnabled, viewerAudioEnabled, audioRoomToken, audioRoomId, audioEndpoint, userRole, hasActiveAudio, audioParticipants])

  // Fetch access tokens for streams
  useEffect(() => {
    const fetchAccessTokens = async () => {
      if (!currentStreamPair?.stream_1?.token_address || !currentStreamPair?.stream_2?.token_address) {
        return
      }

      setFetchingTokens(true)
      try {
        // Fetch tokens for both streams in parallel
        const [token1Response, token2Response] = await Promise.all([
          fetch(`${config.api.baseUrl}/api/v1/streams/access-token/${currentStreamPair.stream_1.token_address}`),
          fetch(`${config.api.baseUrl}/api/v1/streams/access-token/${currentStreamPair.stream_2.token_address}`)
        ])

        const token1Data = token1Response.ok ? await token1Response.json() : null
        const token2Data = token2Response.ok ? await token2Response.json() : null

        setStreamTokens({
          stream1: token1Data?.access_token,
          stream2: token2Data?.access_token
        })

        console.log('Access tokens fetched:', {
          stream1: !!token1Data?.access_token,
          stream2: !!token2Data?.access_token
        })
      } catch (error) {
        console.error('Failed to fetch access tokens:', error)
      } finally {
        setFetchingTokens(false)
      }
    }

    fetchAccessTokens()
  }, [currentStreamPair])

  // Check URL params on mount and fetch initial stream pair
  useEffect(() => {
    console.log('URL params:', { roomParam, tokenParam, roleParam })

    // For streamers, we need to fetch room data first to get stream info
    if (roomParam && (roleParam === 'streamer_a' || roleParam === 'streamer_b')) {
      console.log('🎤 Streamer joining - fetching room data first')

      // Fetch room info to get stream data
      const fetchRoomData = async () => {
        try {
          const response = await fetch(`${config.api.baseUrl}/api/v1/chat/room/${roomParam}/info`)
          const data = await response.json()

          if (data.success && data.stream_pair) {
            // Store the stream pair data
            setCustomStreamPair(data.stream_pair)
            setCustomRoomId(roomParam)

            // Get the correct stream based on role
            const streamToLoad = roleParam === 'streamer_a'
              ? data.stream_pair.stream_1
              : data.stream_pair.stream_2

            if (streamToLoad?.token_address) {
              // Fetch access token for the stream
              const tokenResponse = await fetch(`${config.api.baseUrl}/api/v1/streams/access-token/${streamToLoad.token_address}`)
              const tokenData = await tokenResponse.json()

              if (tokenData.success) {
                console.log('📺 Got stream access token, now showing TalkView')
                // Now we can show TalkView with the stream loaded
                setShowTalkView(true)
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch room data:', error)
          toast({
            title: "Failed to load room",
            description: "Could not fetch room information",
            variant: "destructive"
          })
        }
      }

      fetchRoomData()
    }
    // If URL has a room parameter but we're not a streamer
    else if (roomParam && !roleParam) {
      console.log('📺 Joining room as viewer:', roomParam)
      handleJoinRoom(roomParam)
    } else if (!roomParam && !streamPair) {
      // No room param and no stream pair - fetch initial pair
      console.log('🎲 Fetching initial stream pair')
      fetchNewPair()
    }
  }, [roomParam, tokenParam, roleParam])

  // Debug logging for stream pair
  useEffect(() => {
    if (currentStreamPair) {
      console.log('📺 Current stream pair data:', {
        stream_1: {
          token_name: currentStreamPair.stream_1?.token_name,
          thumbnail_url: currentStreamPair.stream_1?.thumbnail_url,
          hasThumb: !!currentStreamPair.stream_1?.thumbnail_url,
          fullData: currentStreamPair.stream_1
        },
        stream_2: {
          token_name: currentStreamPair.stream_2?.token_name,
          thumbnail_url: currentStreamPair.stream_2?.thumbnail_url,
          hasThumb: !!currentStreamPair.stream_2?.thumbnail_url,
          fullData: currentStreamPair.stream_2
        }
      })
    }
  }, [currentStreamPair])

  // Helper function to process IPFS URLs
  const processImageUrl = (url: string | undefined) => {
    if (!url) return undefined

    // If it's an IPFS URL, use a faster gateway
    if (url.startsWith('https://ipfs.io/ipfs/')) {
      // Convert to cloudflare gateway for better performance
      const hash = url.replace('https://ipfs.io/ipfs/', '')
      return `https://cloudflare-ipfs.com/ipfs/${hash}`
    } else if (url.startsWith('ipfs://')) {
      // Convert to gateway URL
      const hash = url.replace('ipfs://', '')
      return `https://cloudflare-ipfs.com/ipfs/${hash}`
    }

    // Return as-is for other URLs
    return url
  }

  // Polling for audio room status
  useEffect(() => {
    if (!currentStreamPair?.room_id || audioEnabled || viewerAudioEnabled) {
      return
    }

    const checkForActiveAudio = async () => {
      if (currentStreamPair?.room_id && !audioEnabled) {
        console.log('🔄 Polling for audio room status...')

        try {
          const response = await fetch(`${config.api.baseUrl}/api/v1/audio/stream/${currentStreamPair.room_id}`)

          if (response.ok) {
            const data = await response.json()
            console.log('🎙️ Audio room status:', data)

            if (data.success && data.participants && data.participants.length > 0) {
              console.log('✅ Active audio room detected with participants:', data.participants)
              setHasActiveAudio(true)
              setAudioParticipants(data.participants)

              // If we have a viewer token, store it for later use
              if (data.viewer_token && !audioRoomToken) {
                console.log('🎫 Storing viewer token for later use')
                setAudioRoomToken(data.viewer_token)
                setAudioRoomId(currentStreamPair.room_id)
              }
            } else {
              console.log('⏳ No active participants yet')
              setHasActiveAudio(false)
              setAudioParticipants([])
            }
          } else {
            console.log('❌ Audio room check failed:', response.status)
            setHasActiveAudio(false)
            setAudioParticipants([])
          }
        } catch (error) {
          console.error('❌ Error checking audio room:', error)
          setHasActiveAudio(false)
          setAudioParticipants([])
        }
      }
    }

    // Initial check
    checkForActiveAudio()

    // Set up polling interval
    const intervalId = setInterval(() => {
      checkForActiveAudio()
    }, 10000) // Check every 10 seconds

    return () => clearInterval(intervalId)
  }, [currentStreamPair?.room_id, audioEnabled, viewerAudioEnabled])

  // Handle auto-join for streamers when invited via URL
  useEffect(() => {
    if (roomParam && roleParam && isWalletConnected && !audioEnabled && showTalkView) {
      // Small delay to ensure wallet is connected
      setTimeout(() => {
        handleJoinVoiceAsStreamer()
      }, 500)
    }
  }, [isWalletConnected, roleParam, audioEnabled, showTalkView])

  // Show auth errors
  useEffect(() => {
    if (authError) {
      toast({
        title: "Authentication error",
        description: authError,
        variant: "destructive"
      })
    }
  }, [authError, toast])

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
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false)
      }
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

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isWalletConnected) {
      setShowProfileDropdown(!showProfileDropdown)
    } else {
      connectWallet()
    }
  }

  const handleSummonStreamers = async () => {
    if (!currentStreamPair || !isWalletConnected || !user) {
      toast({
        title: "Cannot summon streamers",
        description: !isWalletConnected ? "Please connect your wallet first" : "No active streams",
        variant: "destructive"
      })
      return
    }

    setSummonPending(true)

    try {
      // Get the auth token from localStorage
      const authToken = localStorage.getItem('auth_token')

      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/summon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : ''
        },
        body: JSON.stringify({
          stream_pair_id: roomId,
          streamer_a_id: currentStreamPair.stream_1?.streamer_id || '',
          streamer_b_id: currentStreamPair.stream_2?.streamer_id || '',
          stream_1_mint: currentStreamPair.stream_1?.token_address,
          stream_2_mint: currentStreamPair.stream_2?.token_address
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('Audio room created:', data)

        // Update state with audio room info
        setAudioRoomToken(data.viewer_token)
        setAudioRoomId(data.room_id)
        setAudioEndpoint(data.audio_endpoint || 'wss://pump-udxzob1q.livekit.cloud')
        setUserRole('viewer')
        setAudioEnabled(true)

        toast({
          title: "Streamers summoned!",
          description: "Inviting streamers to join the conversation...",
        })
      } else {
        throw new Error(data.error || 'Failed to summon streamers')
      }
    } catch (error) {
      console.error('Failed to summon streamers:', error)
      toast({
        title: "Failed to summon streamers",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      })
    } finally {
      setSummonPending(false)
    }
  }

  const handleJoinVoiceAsStreamer = async () => {
    console.log('🎤 handleJoinVoiceAsStreamer called')

    if (!isWalletConnected) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to join voice",
        variant: "destructive"
      })
      return
    }

    // If we have the TalkView open, it will handle the joining
    if (showTalkView) {
      console.log('🎤 TalkView is open, it will handle joining')
      return
    }

    // Otherwise handle direct join
    if (roomParam && roleParam) {
      console.log('🎤 Direct join with params:', { roomParam, roleParam })
      // The TalkView component will handle this
      setShowTalkView(true)
    }
  }

  const handleJoinRoom = async (roomIdToJoin: string) => {
    const trimmedRoomId = roomIdToJoin.trim()
    if (!trimmedRoomId) return

    setLoadingRoom(true)
    setCustomRoomId(trimmedRoomId)
    setSearchQuery(trimmedRoomId)

    // Check if we have stored stream data for this room
    const storedStreamData = localStorage.getItem(`room_streams_${trimmedRoomId}`)

    if (storedStreamData) {
      try {
        const roomData = JSON.parse(storedStreamData)
        if (roomData.stream_pair) {
          setCustomStreamPair(roomData.stream_pair)
        } else if (roomData.stream_1 && roomData.stream_2) {
          // Handle the old format
          setCustomStreamPair({
            room_id: trimmedRoomId,
            stream_1: roomData.stream_1,
            stream_2: roomData.stream_2
          })
        }

        // Store stream data with room_id for WebSocket
        if (roomData.stream_1 && roomData.stream_2) {
          const roomStreamData = {
            room_id: roomIdToJoin.trim(),
            stream_1: roomData.stream_1,
            stream_2: roomData.stream_2,
            timestamp: new Date().toISOString()
          }
          localStorage.setItem(`room_streams_${roomIdToJoin.trim()}`, JSON.stringify(roomStreamData))
        }

        toast({
          title: "Room joined",
          description: `Viewing ${roomData.stream_pair?.stream_1?.symbol || roomData.stream_1?.symbol || 'Stream 1'} vs ${roomData.stream_pair?.stream_2?.symbol || roomData.stream_2?.symbol || 'Stream 2'}`,
        })
      } catch (error) {
        console.error('Failed to parse stored stream data:', error)
      }
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
      hasCachedToken: !!audioRoomToken,
      api_url: `${config.api.baseUrl}/api/v1/audio/stream/${currentStreamPair.room_id}`
    })

    // If we already have a cached token from polling, use it directly
    if (audioRoomToken && audioRoomId) {
      console.log('✅ Using cached token from polling')
      setAudioEndpoint('wss://pump-udxzob1q.livekit.cloud')
      setUserRole('viewer')
      setViewerAudioEnabled(true)
      toast({
        title: "Joined audio",
        description: "You can now hear the conversation",
      })
      return
    }

    // Otherwise, fetch a new token
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

          console.log('🎧 Joining as listener with token')
          setAudioRoomToken(data.viewer_token)
          setAudioRoomId(actualRoomId)
          setAudioEndpoint('wss://pump-udxzob1q.livekit.cloud')
          setUserRole('viewer')
          setViewerAudioEnabled(true)

          toast({
            title: "Joined audio",
            description: "You can now hear the conversation",
          })
        } else {
          throw new Error('No viewer token received')
        }
      } else {
        const errorText = await response.text()
        console.error('❌ API Error:', errorText)
        throw new Error(`Failed to join: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to join as listener:', error)
      toast({
        title: "Failed to join",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      })
    }
  }

  const handleNextPair = async () => {
    // Clear audio state when switching pairs
    setHasActiveAudio(false)
    setAudioRoomToken(null)
    setAudioRoomId(null)
    setViewerAudioEnabled(false)
    setAudioParticipants([])

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
        setShowMentionsList(false)
      } else {
        toast({
          title: "Failed to send message",
          description: "Please check your connection and try again.",
          variant: "destructive"
        })
      }
    }
  }

  // Handle message like
  const handleLikeMessage = (messageId: string) => {
    const newLikedMessages = new Set(likedMessages)
    if (newLikedMessages.has(messageId)) {
      newLikedMessages.delete(messageId)
    } else {
      newLikedMessages.add(messageId)
    }
    setLikedMessages(newLikedMessages)
    // TODO: Send like to backend
  }

  // Handle follow/unfollow user
  const handleFollowUser = (userId: string) => {
    const newFollowedUsers = new Set(followedUsers)
    if (newFollowedUsers.has(userId)) {
      newFollowedUsers.delete(userId)
      toast({
        title: "Unfollowed",
        description: "User unfollowed successfully",
      })
    } else {
      newFollowedUsers.add(userId)
      toast({
        title: "Followed",
        description: "User followed successfully",
      })
    }
    setFollowedUsers(newFollowedUsers)
    // TODO: Save to backend/localStorage
  }

  // Handle username click to show profile
  const handleUsernameClick = (msg: ChatMessage) => {
    setSelectedUser({
      id: msg.user_id,
      username: msg.username,
      profile_image: msg.profile_image,
      wallet_address: msg.user_id
    })
    setShowUserProfile(true)
  }

  // Handle @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setNewMessage(value)

    // Check for @ mentions
    const atIndex = value.lastIndexOf('@')
    if (atIndex !== -1) {
      const afterAt = value.substring(atIndex + 1)
      const spaceIndex = afterAt.indexOf(' ')

      if (spaceIndex === -1) {
        // Still typing the mention
        setMentionSearch(afterAt)
        setShowMentionsList(true)
      } else {
        setShowMentionsList(false)
      }
    } else {
      setShowMentionsList(false)
    }
  }

  // Insert mention
  const insertMention = (username: string) => {
    const atIndex = newMessage.lastIndexOf('@')
    if (atIndex !== -1) {
      const beforeAt = newMessage.substring(0, atIndex)
      setNewMessage(`${beforeAt}@${username} `)
      setShowMentionsList(false)
      inputRef.current?.focus()
    }
  }

  // Get unique users from messages for mentions
  const uniqueUsers = Array.from(new Set(wsMessages
    .filter(msg => !msg.is_system)
    .map(msg => msg.username)))
    .filter(username => mentionSearch === '' || username.toLowerCase().includes(mentionSearch.toLowerCase()))

  // Initialize chat position
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setChatPosition({ x: window.innerWidth - 340, y: window.innerHeight - 450 })
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [wsMessages])

  // Handle drag events for chat window
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - chatPosition.x, y: e.clientY - chatPosition.y })
  }

  // Handle resize events
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({
      width: chatSize.width,
      height: chatSize.height,
      x: e.clientX,
      y: e.clientY
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setChatPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      } else if (isResizing) {
        const newWidth = Math.max(280, Math.min(600, resizeStart.width + e.clientX - resizeStart.x))
        const newHeight = Math.max(300, Math.min(800, resizeStart.height + e.clientY - resizeStart.y))
        setChatSize({ width: newWidth, height: newHeight })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeStart])

  // Handle WebSocket errors
  useEffect(() => {
    if (chatError) {
      // The error is already shown in the toast from the useEffect above
      console.log('Chat error:', chatError)
    }
  }, [chatError])

  // Memoized LiveKitStream wrapper to prevent re-renders
  const LiveKitStreamMemoized = useMemo(() => {
    return ({ stream, accessToken, streamId, muted, onMuteChange }: any) => {
      const memoizedStream = useMemo(() => {
        if (!stream) return null
        console.log(`📦 [${streamId}] Creating memoized stream with thumbnail:`, stream.thumbnail_url)
        return {
          ...stream,
          access_token: accessToken || stream.access_token
        }
      }, [stream?.token_address, accessToken])

      if (!memoizedStream) return null

      return (
        <LiveKitStream
          stream={memoizedStream}
          streamId={streamId}
          muted={muted}
          onMuteChange={onMuteChange}
        />
      )
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Full-screen streams container */}
      <div className="absolute inset-0 flex">
        {/* Stream 1 - Left side */}
        <div className="w-1/2 h-full relative">
          {currentStreamPair && currentStreamPair.stream_1 ? (
            <LiveKitStreamMemoized
              stream={currentStreamPair.stream_1}
              accessToken={streamTokens.stream1}
              streamId="stream1"
              muted={streamMuted.stream1}
              onMuteChange={(muted) => setStreamMuted(prev => ({ ...prev, stream1: muted }))}
            />
          ) : (
            <div className="w-full h-full bg-black relative overflow-hidden">
              {/* Blurred thumbnail background during loading */}
              {processImageUrl(currentStreamPair?.stream_1?.thumbnail_url) && (
                <>
                  <img
                    src={processImageUrl(currentStreamPair.stream_1.thumbnail_url)!}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                    onError={(e) => {
                      console.error('Failed to load stream 1 thumbnail:', processImageUrl(currentStreamPair?.stream_1?.thumbnail_url))
                      e.currentTarget.style.display = 'none'
                    }}
                    onLoad={() => console.log('✅ Stream 1 thumbnail loaded successfully')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                </>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#7DE2A1] mx-auto mb-4 drop-shadow-lg" />
                  <p className="text-white font-medium text-lg drop-shadow-lg">
                    {loading ? 'Loading new stream...' : error ? `Error: ${error}` :
                     currentStreamPair?.stream_1?.token_name ? `Connecting to ${currentStreamPair.stream_1.token_name}...` : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TalkView overlay for streamer_a */}
          {showTalkView && roleParam === 'streamer_a' && (
            <TalkView
              roomId={roomParam || ''}
              role="streamer_a"
              onClose={() => {
                setShowTalkView(false)
                router.push('/')
              }}
              onAudioEnabled={(enabled, token, roomId, endpoint) => {
                setAudioEnabled(enabled)
                setAudioRoomToken(token)
                setAudioRoomId(roomId)
                setAudioEndpoint(endpoint)
                setUserRole('streamer')
                setMicEnabled(true)
              }}
              isMuted={!micEnabled}
              onMuteChange={(muted) => setMicEnabled(!muted)}
            />
          )}
        </div>

        {/* Stream 2 - Right side */}
        <div className="w-1/2 h-full relative">
          {currentStreamPair && currentStreamPair.stream_2 ? (
            <LiveKitStreamMemoized
              stream={currentStreamPair.stream_2}
              accessToken={streamTokens.stream2}
              streamId="stream2"
              muted={streamMuted.stream2}
              onMuteChange={(muted) => setStreamMuted(prev => ({ ...prev, stream2: muted }))}
            />
          ) : (
            <div className="w-full h-full bg-black relative overflow-hidden">
              {/* Blurred thumbnail background */}
              {processImageUrl(currentStreamPair?.stream_2?.thumbnail_url) && (
                <>
                  <img
                    src={processImageUrl(currentStreamPair.stream_2.thumbnail_url)!}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                    onError={(e) => {
                      console.error('Failed to load stream 2 thumbnail:', processImageUrl(currentStreamPair?.stream_2?.thumbnail_url))
                      e.currentTarget.style.display = 'none'
                    }}
                    onLoad={() => console.log('✅ Stream 2 thumbnail loaded successfully')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                </>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#7DE2A1] mx-auto mb-4 drop-shadow-lg" />
                  <p className="text-white font-medium text-lg drop-shadow-lg">
                    {loading ? 'Loading new stream...' : error ? `Error: ${error}` :
                     currentStreamPair?.stream_2?.token_name ? `Connecting to ${currentStreamPair.stream_2.token_name}...` : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TalkView overlay for streamer_b */}
          {showTalkView && roleParam === 'streamer_b' && (
            <TalkView
              roomId={roomParam || ''}
              role="streamer_b"
              onClose={() => {
                setShowTalkView(false)
                router.push('/')
              }}
              onAudioEnabled={(enabled, token, roomId, endpoint) => {
                setAudioEnabled(enabled)
                setAudioRoomToken(token)
                setAudioRoomId(roomId)
                setAudioEndpoint(endpoint)
                setUserRole('streamer')
                setMicEnabled(true)
              }}
              isMuted={!micEnabled}
              onMuteChange={(muted) => setMicEnabled(!muted)}
            />
          )}
        </div>
      </div>

      {/* Floating Header with transparency */}
      <header className="absolute top-0 left-0 right-0 z-40 bg-black/10 backdrop-blur-xl border-b border-white/5">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Image
                  src="/image.svg"
                  alt="Pump Roulette Logo"
                  width={36}
                  height={36}
                  className="w-9 h-9"
                />
              </div>
              <div className="flex items-center">
                <span className="font-light text-[#7DE2A1] text-2xl tracking-wide">Pump</span>
                <span className="font-semibold text-white text-2xl tracking-wide">Roulette</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customRoomId && (
              <button
                onClick={handleBackToRandomRoom}
                className="h-8 px-3 bg-gray-600/50 hover:bg-gray-600/70 backdrop-blur text-white font-bold rounded-sm text-xs flex items-center gap-1.5 transition-all"
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Random</span>
              </button>
            )}

            {/* Summon Button - Primary CTA */}
            {currentStreamPair && (
              <button
                onClick={handleSummonStreamers}
                disabled={summonPending || audioEnabled || viewerAudioEnabled || hasActiveAudio}
                className="h-8 px-4 bg-gradient-to-r from-[#7DE2A1] to-[#83EFAA] hover:from-[#6dd291] hover:to-[#73df9a] disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Radio className={`h-3.5 w-3.5 ${summonPending ? 'animate-pulse' : ''}`} />
                <span>Summon</span>
              </button>
            )}

            <button
              onClick={() => router.push('/rooms')}
              className="h-8 px-3 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-sm text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rooms</span>
            </button>

            <div className="relative profile-dropdown-container">
              <button
                onClick={handleProfileClick}
                disabled={isConnecting}
                className="h-8 px-3 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-sm text-xs font-medium transition-all flex items-center gap-1.5"
              >
                {isConnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : user && isWalletConnected ? (
                  <>
                    <span className="truncate max-w-[80px]">{user.display_name || user.username || 'User'}</span>
                    <ChevronRight className={`h-3 w-3 transition-transform ${showProfileDropdown ? 'rotate-90' : ''}`} />
                  </>
                ) : (
                  'Login'
                )}
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileDropdown && user && isWalletConnected && (
                <div className="absolute top-full mt-1 right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl z-50">
                  <div className="p-3 border-b border-white/10">
                    <div className="text-white font-medium text-sm truncate">
                      {user.display_name || user.username}
                    </div>
                    <div className="text-gray-400 text-xs font-mono truncate">
                      {user.wallet_address?.slice(0, 6)}...{user.wallet_address?.slice(-4)}
                    </div>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => {
                        setShowProfileModal(true)
                        setShowProfileDropdown(false)
                        setEditedProfile({
                          username: user.display_name || user.username || '',
                          bio: user.bio || '',
                          profile_image: user.profile_image || ''
                        })
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 rounded transition-colors flex items-center gap-2"
                    >
                      <User className="h-3.5 w-3.5" />
                      View Profile
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(user.wallet_address || '')
                        toast({
                          title: "Copied!",
                          description: "Wallet address copied to clipboard"
                        })
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/10 rounded transition-colors"
                    >
                      Copy Address
                    </button>
                    <button
                      onClick={() => {
                        logout()
                        setShowProfileDropdown(false)
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/10 rounded transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Chat toggle button */}
            <button
              onClick={() => setShowChat(!showChat)}
              className="h-8 px-3 bg-white/10 hover:bg-white/20 backdrop-blur text-white rounded-sm text-xs font-medium transition-all flex items-center gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{showChat ? 'Hide' : 'Show'} Chat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Audio controls bar - floating below header */}
      {(hasActiveAudio || audioEnabled || viewerAudioEnabled || streamerJoinPending) && (
        <div className="absolute top-14 left-0 right-0 z-30 bg-black/60 backdrop-blur-md border-b border-white/10">
          <div className="h-10 px-4 flex items-center justify-center gap-2">
            {/* Audio status indicator */}
            {(hasActiveAudio || audioEnabled || viewerAudioEnabled) && (
              <div className="flex items-center gap-2">
                {viewerAudioEnabled ? (
                  <>
                    <div className="flex items-center gap-1.5 text-green-400">
                      <Headphones className="w-4 h-4" />
                      <span className="text-xs">Listening</span>
                    </div>
                    <span className="text-xs text-green-400">{audioParticipants.length} streamer{audioParticipants.length > 1 ? 's' : ''} active</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">
                    {audioRoomToken ? 'Streamers ready - click Listen to join!' : 'Waiting for streamers to join...'}
                  </span>
                )}
              </div>
            )}

            {/* Streamer controls */}
            {userRole === 'streamer' && audioEnabled && (
              <>
                <div className="px-2 py-1 bg-red-500 rounded text-white font-semibold animate-pulse text-xs">
                  LIVE
                </div>
                <button
                  onClick={() => setMicEnabled(!micEnabled)}
                  className={`px-2 py-1 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 ${
                    !micEnabled
                      ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                      : 'bg-white/10 text-white border border-white/20'
                  }`}
                >
                  {!micEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <span>{!micEnabled ? 'Unmute' : 'Mute'}</span>
                </button>
                <button
                  onClick={() => {
                    setAudioEnabled(false)
                    window.location.href = '/'
                  }}
                  className="px-2 py-1 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5"
                >
                  <PhoneOff className="h-4 w-4" />
                  <span>Leave</span>
                </button>
              </>
            )}

            {/* Listen button for viewers */}
            {hasActiveAudio && !audioEnabled && !viewerAudioEnabled && userRole === 'viewer' && !showTalkView && roleParam !== 'streamer_a' && roleParam !== 'streamer_b' && (
              <button
                onClick={handleJoinAsListener}
                className="px-3 py-1 rounded-sm text-xs font-medium bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 transition-all flex items-center gap-1.5"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Listen to Conversation</span>
              </button>
            )}

            {/* Stop listening button */}
            {viewerAudioEnabled && (
              <button
                onClick={() => {
                  setViewerAudioEnabled(false)
                  setAudioRoomToken(null)
                  setAudioRoomId(null)
                }}
                className="px-3 py-1 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5"
              >
                <VolumeX className="h-3.5 w-3.5" />
                <span>Stop Listening</span>
              </button>
            )}

            {/* Join voice button for streamers */}
            {streamerJoinPending && !audioEnabled && (
              <button
                onClick={handleJoinVoiceAsStreamer}
                className="px-3 py-1 rounded-sm text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 animate-pulse transition-all flex items-center gap-1.5"
              >
                <Mic className="h-4 w-4" />
                <span>Join Voice</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Next Pair Logo Button - floating in center */}
      {!customRoomId && currentStreamPair && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
          <button
            onClick={handleNextPair}
            disabled={loading}
            className="group relative p-4 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full transition-all duration-300 hover:scale-110"
            title="Next Pair"
          >
            <div className={`relative transition-transform duration-1000 ${loading ? 'animate-[spin_1.5s_cubic-bezier(0.68,-0.55,0.265,1.55)_infinite]' : ''}`}>
              <img
                src="/logo.png"
                alt="Next Pair"
                className="w-16 h-16 object-contain"
              />
            </div>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-[#83EFAA] border-t-transparent animate-[spin_1s_linear_infinite]"></div>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Chat floating window */}
      {showChat && (
        <div
          className="fixed z-50 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl"
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            width: `${chatSize.width}px`,
            height: `${chatSize.height}px`
          }}
        >
          <div className="h-full flex flex-col">
            {/* Chat header - draggable */}
            <div
              className="p-3 border-b border-white/5 bg-white/[0.02] rounded-t-lg cursor-move select-none"
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-semibold text-sm">Chat</h3>
                  <span className="text-xs text-gray-400">
                    {wsMessages.length} messages
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${chatConnected ? 'bg-green-400' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-400">
                      {chatConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages container */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide"
            >
              <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {wsMessages.map((msg) => (
                <div key={msg.id} className={`${msg.is_system ? 'text-center py-1' : ''}`}>
                  {msg.is_system ? (
                    <div className="text-[10px] text-gray-500 italic">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 group">
                      <img
                        src={msg.profile_image || `https://ui-avatars.com/api/?name=${msg.username}&background=666&color=fff&size=64&rounded=true`}
                        alt={msg.username}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = `https://ui-avatars.com/api/?name=${msg.username}&background=666&color=fff&size=64&rounded=true`
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <button
                            onClick={() => handleUsernameClick(msg)}
                            className="text-white text-xs font-semibold hover:text-[#7DE2A1] transition-colors cursor-pointer"
                          >
                            {msg.username}
                          </button>
                          <span className="text-gray-500 text-[10px]">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {/* Reply context */}
                        {msg.reply_to && (() => {
                          const repliedMessage = wsMessages.find(m => m.id === msg.reply_to)
                          if (repliedMessage) {
                            return (
                              <div className="mb-1 pl-2 border-l-2 border-gray-600">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-500">↳ Replying to</span>
                                  <span className="text-[10px] text-gray-400 font-medium">{repliedMessage.username}</span>
                                </div>
                                <p className="text-[10px] text-gray-500 truncate max-w-[250px]">
                                  {repliedMessage.content}
                                </p>
                              </div>
                            )
                          }
                          return null
                        })()}
                        {/* Message content */}
                        <div className="bg-white/[0.03] backdrop-blur-sm rounded-md px-2.5 py-1.5 inline-block max-w-[90%] border border-white/5">
                          <p className="text-white text-xs break-words leading-relaxed">
                            {msg.content.split(' ').map((word, i) => {
                              if (word.startsWith('@')) {
                                const username = word.substring(1)
                                return (
                                  <span key={i}>
                                    <span className="text-[#7DE2A1] font-medium">@{username}</span>{' '}
                                  </span>
                                )
                              }
                              return word + ' '
                            })}
                          </p>
                        </div>
                        {/* Message actions */}
                        {isWalletConnected && !msg.is_system && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1">
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-full text-[10px] text-gray-400 hover:text-white transition-all flex items-center gap-1"
                            >
                              <MessageSquare className="h-3 w-3" />
                              Reply
                            </button>
                            <button
                              onClick={() => handleLikeMessage(msg.id)}
                              className={`px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-full text-[10px] transition-all flex items-center gap-1 ${
                                likedMessages.has(msg.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${likedMessages.has(msg.id) ? 'fill-current' : ''}`} />
                              {(msg.reactions?.likes || 0) + (likedMessages.has(msg.id) ? 1 : 0)}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat input */}
            {isWalletConnected ? (
              <div className="p-3 border-t border-white/5 bg-white/[0.02] rounded-b-lg relative">
                {/* Reply indicator */}
                {replyingTo && (
                  <div className="mb-2 px-3 py-2 bg-white/[0.03] backdrop-blur-sm rounded-sm flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Replying to</span>
                      <span className="text-xs text-white font-medium">{replyingTo.username}</span>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {/* Mentions dropdown */}
                {showMentionsList && uniqueUsers.length > 0 && (
                  <div className="absolute bottom-full mb-1 left-3 right-3 max-h-32 overflow-y-auto bg-black/20 backdrop-blur-xl border border-white/10 rounded-md shadow-2xl">
                    {uniqueUsers.slice(0, 5).map((username) => (
                      <button
                        key={username}
                        onClick={() => insertMention(username)}
                        className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-white/20 transition-colors flex items-center gap-2"
                      >
                        <AtSign className="h-3 w-3 text-[#7DE2A1]" />
                        {username}
                      </button>
                    ))}
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
                    ref={inputRef}
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder={chatConnected ? "Type a message..." : "Connecting..."}
                    disabled={!chatConnected}
                    className="flex-1 px-3 py-1.5 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-sm text-sm text-white placeholder:text-gray-500 focus:border-white/20 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || !chatConnected}
                    className="px-2.5 py-1.5 bg-[#83EFAA] hover:bg-[#73df9a] disabled:opacity-50 text-black rounded-sm font-medium transition-all"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 border-t border-white/5 bg-white/[0.02] rounded-b-lg text-center">
                <p className="text-xs text-gray-400 mb-2">Connect wallet to chat</p>
                <button
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-50 text-black font-semibold rounded-sm text-xs transition-colors"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            )}
          </div>
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            onMouseDown={handleResizeMouseDown}
          >
            <svg className="w-4 h-4 text-white/30" viewBox="0 0 16 16">
              <path
                fill="currentColor"
                d="M14 14l-4 0l0 -1l3 0l0 -3l1 0l0 4zm-5 0l0 -1l4 0l0 1l-4 0zm0 -4l0 -1l4 0l0 1l-4 0z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Floating footer with status */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 bg-black/10 backdrop-blur-xl border-t border-white/5">
        <div className="h-10 px-4 flex items-center justify-center">
          <div className="text-xs text-gray-400">
            {summonPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Summoning streamers...</span>
              </div>
            ) : audioEnabled && !hasActiveAudio ? (
              <span>Waiting for streamers to join...</span>
            ) : hasActiveAudio && audioParticipants.length > 0 ? (
              <span className="text-green-400">{audioParticipants.length} streamer{audioParticipants.length > 1 ? 's' : ''} in conversation</span>
            ) : chatConnected ? (
              <span className="text-gray-500">Connected to room {roomId.slice(0, 8)}</span>
            ) : (
              <span>Connecting...</span>
            )}
          </div>
        </div>
      </footer>

      {/* Audio Room Component */}
      {(audioEnabled || viewerAudioEnabled) && audioRoomToken && audioRoomId && (
        <AudioRoom
          roomId={audioRoomId}
          token={audioRoomToken}
          livekitUrl={audioEndpoint || 'wss://pump-udxzob1q.livekit.cloud'}
          role={userRole}
          onParticipantsChange={(participants) => {
            console.log('🎙️ Participants updated:', participants)
            setAudioParticipants(participants)
          }}
        />
      )}

      {/* Progress Bar */}
      {loading && <ProgressBar isLoading={loading} />}

      {/* Current User Profile Modal */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowProfileModal(false)
          setIsEditingProfile(false)
        }}>
          <div
            className="bg-black/60 backdrop-blur-xl rounded-lg p-6 max-w-md w-full border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold">My Profile</h2>
              <div className="flex items-center gap-2">
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowProfileModal(false)
                    setIsEditingProfile(false)
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Profile Picture */}
              <div className="flex justify-center">
                <div className="relative">
                  <img
                    src={editedProfile.profile_image || user.profile_image || `https://ui-avatars.com/api/?name=${user.username}&background=666&color=fff&size=128&rounded=true`}
                    alt={user.username}
                    className="w-24 h-24 rounded-full border-2 border-[#7DE2A1]"
                  />
                  {isEditingProfile && (
                    <button className="absolute bottom-0 right-0 bg-[#7DE2A1] text-black rounded-full p-1.5 hover:bg-[#6dd291] transition-colors">
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Username</label>
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={editedProfile.username}
                    onChange={(e) => setEditedProfile({ ...editedProfile, username: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:border-[#7DE2A1] focus:outline-none transition-colors"
                    placeholder="Enter username"
                  />
                ) : (
                  <div className="text-white text-sm font-medium">
                    {user.display_name || user.username || 'Anonymous'}
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Bio</label>
                {isEditingProfile ? (
                  <textarea
                    value={editedProfile.bio}
                    onChange={(e) => setEditedProfile({ ...editedProfile, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:border-[#7DE2A1] focus:outline-none transition-colors resize-none"
                    rows={3}
                    placeholder="Tell us about yourself"
                  />
                ) : (
                  <div className="text-white text-sm">
                    {user.bio || 'No bio yet'}
                  </div>
                )}
              </div>

              {/* Wallet Address */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Wallet Address</label>
                <div className="flex items-center gap-2">
                  <div className="text-white text-xs font-mono flex-1 truncate">
                    {user.wallet_address}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.wallet_address || '')
                      toast({
                        title: "Copied!",
                        description: "Wallet address copied to clipboard"
                      })
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditingProfile && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      // TODO: Save profile changes to backend
                      toast({
                        title: "Profile updated",
                        description: "Your changes have been saved"
                      })
                      setIsEditingProfile(false)
                    }}
                    className="flex-1 py-2 px-4 bg-[#7DE2A1] text-black rounded-lg font-medium hover:bg-[#6dd291] transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProfile(false)
                      setEditedProfile({
                        username: user.display_name || user.username || '',
                        bio: user.bio || '',
                        profile_image: user.profile_image || ''
                      })
                    }}
                    className="flex-1 py-2 px-4 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other User Profile Modal */}
      {showUserProfile && selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowUserProfile(false)}>
          <div
            className="bg-black/60 backdrop-blur-xl rounded-lg p-6 max-w-md w-full border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold">User Profile</h2>
              <button
                onClick={() => setShowUserProfile(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedUser.profile_image || `https://ui-avatars.com/api/?name=${selectedUser.username}&background=666&color=fff&size=128&rounded=true`}
                alt={selectedUser.username}
                className="w-20 h-20 rounded-full border-2 border-[#7DE2A1]"
              />
              <div className="flex-1">
                <h3 className="text-white text-xl font-semibold mb-1">{selectedUser.username}</h3>
                <p className="text-gray-400 text-xs font-mono">
                  {selectedUser.wallet_address?.slice(0, 8)}...{selectedUser.wallet_address?.slice(-8)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Messages</span>
                <span className="text-white font-medium">
                  {wsMessages.filter(m => m.user_id === selectedUser.id).length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-gray-400 text-sm">Member since</span>
                <span className="text-white font-medium">Today</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleFollowUser(selectedUser.id)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  followedUsers.has(selectedUser.id)
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-[#7DE2A1] text-black hover:bg-[#6dd291]'
                }`}
              >
                {followedUsers.has(selectedUser.id) ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Follow
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowUserProfile(false)
                  if (inputRef.current) {
                    setNewMessage(`@${selectedUser.username} `)
                    inputRef.current.focus()
                  }
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
              >
                <AtSign className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}