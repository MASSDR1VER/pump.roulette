/**
 * LiveKit Stream Component
 * Displays Pump.fun live streams using LiveKit SDK
 */

import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, VideoPresets, RemoteTrack } from 'livekit-client'
import { Loader2, Volume2, VolumeX, Users, Copy, ExternalLink, Heart, Share2, Flame, Send, Globe, AlertTriangle, CheckCircle, Mic, MicOff, PhoneOff } from 'lucide-react'

interface StreamData {
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
  market_cap?: number
  usd_market_cap?: number
  price_change_24h?: number
  volume_24h?: number
  is_trending?: boolean
  is_verified?: boolean
  symbol?: string
  description?: string
  twitter?: string
  telegram?: string
  website?: string
  is_nsfw?: boolean
  creator_username?: string
  creator_profile_image?: string
  total_supply?: number
  holders?: number
}

interface LiveKitStreamProps {
  stream: StreamData
  streamId: 'stream1' | 'stream2'
  muted: boolean
  onMuteChange?: (muted: boolean) => void
  // Streamer controls props
  isStreamer?: boolean
  micEnabled?: boolean
  onMicToggle?: () => void
  onLeaveStream?: () => void
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1` : 'https://app.pump-roulette.com/api/v1'

export function LiveKitStream({ stream, streamId, muted, onMuteChange, isStreamer, micEnabled, onMicToggle, onLeaveStream }: LiveKitStreamProps) {
  // Debug log to check if thumbnail is being passed
  console.log(`🖼️ [${streamId}] LiveKitStream received:`, {
    token_name: stream?.token_name,
    thumbnail_url: stream?.thumbnail_url,
    hasThumbnail: !!stream?.thumbnail_url,
    thumbnailType: typeof stream?.thumbnail_url
  })

  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [audioTracks, setAudioTracks] = useState<RemoteTrack[]>([])
  const [videoTracks, setVideoTracks] = useState<RemoteTrack[]>([])
  const [copied, setCopied] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showControls, setShowControls] = useState(false) // Hidden by default, show on hover
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const connectionAttemptRef = useRef<boolean>(false)
  const roomRef = useRef<Room | null>(null)
  const streamKeyRef = useRef<string>('')
  const previousTokenAddress = useRef<string | undefined>(undefined)
  const isMountedRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Track mount status
    isMountedRef.current = true

    // Abort any previous connection attempts
    if (abortControllerRef.current) {
      console.log(`[${streamId}] Aborting previous connection attempt`)
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this connection attempt
    abortControllerRef.current = new AbortController()

    // Log when stream changes
    if (stream?.token_address) {
      console.log(`[${streamId}] Stream changed to ${stream.token_address}`)
      // Store previous token address for cleanup
      previousTokenAddress.current = stream.token_address
    }

    // Create a unique key for this stream instance
    const streamKey = `${stream?.token_address}-${streamId}-${Date.now()}`
    streamKeyRef.current = streamKey

    const connectWithToken = async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) {
        console.log(`[${streamId}] Component unmounted, aborting connection`)
        return
      }

      // Check if this is still the current stream
      if (streamKeyRef.current !== streamKey) {
        console.log(`[${streamId}] Stream changed, aborting connection attempt`)
        return
      }

      // Prevent multiple simultaneous connections
      if (connectionAttemptRef.current) {
        console.log(`[${streamId}] Connection attempt already in progress, skipping...`)
        return
      }

      connectionAttemptRef.current = true

      try {
        setIsConnecting(true)
        setIsLoading(true)
        setError(null)

        // Always fetch fresh user-specific token for each connection
        // to ensure each user gets their own LiveKit participant
        console.log(`[${streamId}] Fetching new access token for:`, stream.token_address)

        // Generate unique user ID for each viewer
        const getUserId = () => {
          // Try to get wallet address from localStorage (if user is authenticated)
          const authToken = localStorage.getItem('auth_token')
          if (authToken) {
            try {
              // Decode the JWT to get wallet address
              const payload = JSON.parse(atob(authToken.split('.')[1]))
              return payload.wallet_address || payload.sub
            } catch (e) {
              // If can't decode, fall back to generating unique session ID
            }
          }

          // For guests, generate or get existing session ID
          let sessionId = localStorage.getItem('viewer_session_id')
          if (!sessionId) {
            sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            localStorage.setItem('viewer_session_id', sessionId)
          }
          return sessionId
        }

        const userId = getUserId()
        const response = await fetch(`${API_BASE_URL}/streams/access-token/${stream.token_address}?user_id=${encodeURIComponent(userId)}`, {
          signal: abortControllerRef.current?.signal
        })

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Stream not available or not live')
          }
          throw new Error(`Failed to get access token: ${response.statusText}`)
        }

        const data = await response.json()

        if (!data.access_token) {
          throw new Error('No access token received from server')
        }

        const token = data.access_token
        console.log(`[${streamId}] Got fresh token for ${stream.token_address}`)

        // Check again if this is still the current stream before connecting
        if (streamKeyRef.current !== streamKey) {
          console.log(`[${streamId}] Stream changed during token fetch, aborting`)
          return
        }

        // Always connect with fresh token
        setCurrentToken(token)
        await connectToRoom(token, streamKey)

      } catch (error: any) {
        // Ignore abort errors
        if (error?.name === 'AbortError') {
          console.log(`[${streamId}] Connection aborted`)
          return
        }
        console.error(`[${streamId}] Failed to connect to stream:`, error)
        setError(error instanceof Error ? error.message : 'Unable to connect to stream')
        setIsLoading(false)
      } finally {
        if (isMountedRef.current) {
          setIsConnecting(false)
          connectionAttemptRef.current = false
        }
      }
    }

    // Connect if we have stream data
    if (stream?.token_address) {
      // Small delay to prevent double connection in StrictMode
      const connectTimer = setTimeout(() => {
        if (isMountedRef.current) {
          connectWithToken()
        }
      }, 100)

      return () => {
        clearTimeout(connectTimer)
      }
    } else {
      setError('Stream information missing')
      setIsLoading(false)
    }

    return () => {
      // Mark as unmounted
      isMountedRef.current = false

      // Abort any pending fetch requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Cleanup when stream changes or component unmounts
      console.log(`[${streamId}] Cleanup for stream key: ${streamKey}`)
      if (streamKeyRef.current === streamKey && roomRef.current) {
        disconnect()
      }
    }
  }, [stream?.token_address, streamId]) // Only re-run when stream changes

  const connectToRoom = async (token: string, expectedStreamKey: string) => {
    // Double check we're not already connecting
    if (roomRef.current?.state === 'connecting') {
      console.log(`[${streamId}] Already connecting to room, aborting duplicate attempt`)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Disconnect existing room if any
      if (roomRef.current && roomRef.current.state !== 'disconnected') {
        console.log(`[${streamId}] Disconnecting existing room (state: ${roomRef.current.state})`)
        try {
          await roomRef.current.disconnect()
        } catch (e) {
          console.warn(`[${streamId}] Error disconnecting existing room:`, e)
        }
        roomRef.current = null
        setRoom(null)
      }

      // Check if stream key is still valid before continuing
      if (streamKeyRef.current !== expectedStreamKey || !isMountedRef.current) {
        console.log(`[${streamId}] Stream changed or unmounted, aborting room connection`)
        return
      }

      // Create room with unique identifier to prevent conflicts
      const roomInstanceId = `${streamId}-${Date.now()}`
      console.log(`[${streamId}] Creating new room instance: ${roomInstanceId}`)

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      })

      // Store room reference immediately to prevent duplicate creation
      roomRef.current = newRoom
      setRoom(newRoom)

      newRoom.on(RoomEvent.Connected, () => {
        // Final check if this is still the expected stream
        if (streamKeyRef.current !== expectedStreamKey) {
          console.log(`[${streamId}] Stream changed after connection, disconnecting`)
          newRoom.disconnect()
          return
        }
        console.log(`[${streamId}] ✅ Connected to LiveKit room`)
        console.log(`[${streamId}] Room participants:`, newRoom.participants ? newRoom.participants.size : 0)
        console.log(`[${streamId}] Room state:`, newRoom.state)
      })

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity, 'for stream:', streamId)
      })

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('Track published:', publication.trackName, 'by:', participant.identity, 'for stream:', streamId)
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        // Check if this is still the expected stream
        if (streamKeyRef.current !== expectedStreamKey) {
          console.log(`[${streamId}] Stream changed, ignoring track`)
          return
        }

        if (track instanceof RemoteTrack) {
          if (track.kind === Track.Kind.Video) {
            console.log(`[${streamId}] Video track received from participant:`, participant.identity)
            setVideoTracks(prev => [...prev, track])

            if (videoContainerRef.current) {
              // Clear existing video elements first
              while (videoContainerRef.current.firstChild) {
                videoContainerRef.current.removeChild(videoContainerRef.current.firstChild)
              }

              const element = track.attach()
              element.className = 'w-full h-full object-cover'
              element.style.width = '100%'
              element.style.height = '100%'
              element.style.objectFit = 'cover'
              element.setAttribute('data-stream-key', expectedStreamKey)
              videoContainerRef.current.appendChild(element)

              console.log(`[${streamId}] Video element attached to DOM`)
              setIsLoading(false)
            }
          } else if (track.kind === Track.Kind.Audio) {
            console.log(`[${streamId}] Audio track received from participant:`, participant.identity)
            setAudioTracks(prev => [...prev, track])

            const element = track.attach() as HTMLAudioElement
            element.style.display = 'none'
            element.setAttribute('data-livekit', 'true')
            element.setAttribute('data-stream', streamId)
            element.setAttribute('data-stream-key', expectedStreamKey)
            element.muted = muted
            document.body.appendChild(element)
          }
        }
      })

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track instanceof RemoteTrack) {
          track.detach()

          if (track.kind === Track.Kind.Video) {
            setVideoTracks(prev => prev.filter(t => t !== track))
          } else if (track.kind === Track.Kind.Audio) {
            setAudioTracks(prev => prev.filter(t => t !== track))
          }
        }
      })

      // Final check before connecting
      if (streamKeyRef.current !== expectedStreamKey) {
        console.log(`[${streamId}] Stream changed before connect, aborting`)
        return
      }

      await newRoom.connect(
        'wss://pump-prod-tg2x8veh.livekit.cloud',
        token,
        {
          autoSubscribe: true,
        }
      )

      // Store room only if stream is still current
      if (streamKeyRef.current === expectedStreamKey) {
        setRoom(newRoom)
        console.log(`[${streamId}] Successfully connected and stored room`)
      } else {
        console.log(`[${streamId}] Stream changed after connect, disconnecting`)
        await newRoom.disconnect()
      }

    } catch (err: any) {
      console.error(`[${streamId}] Failed to connect to room:`, err)
      setError(err.message || 'Failed to connect to stream')
      setIsLoading(false)

      // Clear connection attempt flag on error
      connectionAttemptRef.current = false
    }
  }

  const disconnect = () => {
    console.log(`[${streamId}] Disconnecting stream`)

    // Stop and detach all tracks
    const allTracks = [...audioTracks, ...videoTracks]
    allTracks.forEach(track => {
      try {
        track.stop()
        track.detach()
      } catch (e) {
        console.error(`[${streamId}] Error stopping track:`, e)
      }
    })

    setAudioTracks([])
    setVideoTracks([])

    // Disconnect room
    if (roomRef.current) {
      try {
        roomRef.current.disconnect()
        roomRef.current.removeAllListeners()
      } catch (e) {
        console.error(`[${streamId}] Error disconnecting room:`, e)
      }
      roomRef.current = null
      setRoom(null)
    }

    // Clear video container
    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = ''
    }

    // Remove audio elements for this stream
    const audioElements = document.querySelectorAll(`audio[data-stream="${streamId}"]`)
    audioElements.forEach(el => el.remove())

    // Clear current token to force refresh on next connect
    setCurrentToken(null)
    connectionAttemptRef.current = false
    setIsConnecting(false)
  }

  useEffect(() => {
    // Update audio elements when muted prop changes
    const audios = document.querySelectorAll(`audio[data-stream="${streamId}"]`) as NodeListOf<HTMLAudioElement>
    audios.forEach(audio => {
      audio.muted = muted
    })

    const videos = videoContainerRef.current?.getElementsByTagName('video')
    if (videos) {
      for (let video of videos) {
        video.muted = muted
      }
    }
  }, [muted, streamId])

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(stream.token_address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenPumpFun = () => {
    window.open(`https://pump.fun/coin/${stream.token_address}`, '_blank')
  }

  const handleFavorite = () => {
    setIsFavorited(!isFavorited)
    // TODO: Save to backend/localStorage
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    setShowShare(true)
    setTimeout(() => setShowShare(false), 2000)
  }

  const formatMarketCap = (cap?: number) => {
    if (!cap) return 'N/A'
    if (cap >= 1000000) return `$${(cap / 1000000).toFixed(2)}M`
    if (cap >= 1000) return `$${(cap / 1000).toFixed(1)}K`
    return `$${cap.toFixed(2)}`
  }


  return (
    <div
      className="flex-1 bg-transparent relative w-full h-full"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video container */}
      <div
        ref={videoContainerRef}
        className="absolute inset-0 w-full h-full bg-black"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'black'
        }}
      />

      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 z-10 overflow-hidden bg-black">
          {/* Blurred thumbnail background */}
          {stream.thumbnail_url && (
            <>
              <img
                src={stream.thumbnail_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
                style={{
                  filter: 'blur(30px)',
                  transform: 'scale(1.1)'
                }}
                onError={(e) => {
                  console.error('Failed to load thumbnail:', stream.thumbnail_url)
                  e.currentTarget.style.display = 'none'
                }}
                onLoad={() => {
                  console.log('✅ Thumbnail loaded successfully for', stream.token_name)
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/50" />
            </>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-black/40 backdrop-blur-md rounded-lg p-6 border border-white/10">
              <Loader2 className="w-10 h-10 animate-spin text-[#7DE2A1] mb-3 mx-auto drop-shadow-lg" />
              <p className="text-white font-medium mb-1 text-lg drop-shadow-lg">Connecting to stream</p>
              <p className="text-[#9ca3af] text-sm drop-shadow-lg">{stream.token_name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={async () => {
                // Clear state and retry
                setCurrentToken(null)
                connectionAttemptRef.current = false
                streamKeyRef.current = ''

                try {
                  setIsLoading(true)
                  setError(null)

                  const response = await fetch(`${API_BASE_URL}/streams/access-token/${stream.token_address}`)

                  if (!response.ok) {
                    throw new Error('Failed to get access token')
                  }

                  const data = await response.json()

                  if (data.access_token) {
                    const streamKey = `${stream.token_address}-${streamId}-${Date.now()}`
                    streamKeyRef.current = streamKey
                    setCurrentToken(data.access_token)
                    await connectToRoom(data.access_token, streamKey)
                  } else {
                    throw new Error('No access token available')
                  }
                } catch (err) {
                  console.error(`[${streamId}] Retry failed:`, err)
                  setError('Unable to connect to stream')
                  setIsLoading(false)
                }
              }}
              className="px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black font-semibold rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Top overlay - centered more */}
      <div className={`absolute top-20 left-16 right-16 flex justify-between transition-all duration-300 ${
        showControls ? 'opacity-100 scale-100' : 'opacity-60 scale-95'
      }`}>
        {/* Left side - Status badges */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-[#7DE2A1] rounded text-black text-xs font-bold flex items-center gap-1.5">
            LIVE
          </div>
          {/* Volume button moved here */}
          <button
            onClick={() => onMuteChange?.(!muted)}
            className="px-2 py-1 bg-[#181821]/90 hover:bg-[#181821] backdrop-blur-sm rounded transition-all flex items-center justify-center"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5 text-[#9ca3af]" /> : <Volume2 className="h-3.5 w-3.5 text-[#7DE2A1]" />}
          </button>
          {stream.is_trending && (
            <div className="px-2.5 py-1 bg-orange-500 rounded text-white text-xs font-bold flex items-center gap-1">
              <Flame className="h-3 w-3" />
              HOT
            </div>
          )}
          {stream.is_nsfw && (
            <div className="px-2.5 py-1 bg-red-500 rounded text-white text-xs font-bold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              NSFW
            </div>
          )}
        </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleOpenPumpFun}
              className="px-3 py-1.5 bg-[#7DE2A1] hover:bg-[#6dd291] text-black rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              pump.fun
            </button>
          </div>
      </div>

      {/* Bottom overlay with stream info - centered more */}
      <div className={`absolute bottom-20 left-16 right-16 bg-black/75 backdrop-blur-md p-4 rounded-xl transition-all duration-300 ${
        showControls ? 'opacity-100 scale-100' : 'opacity-60 scale-95'
      }`}>
        {/* Stream info bar */}
        <div className="mb-2">
          <div className="flex items-center gap-3">
            {/* Profile image */}
            {stream.creator_profile_image && (
              <img
                src={stream.creator_profile_image}
                alt={stream.streamer_name}
                className="w-8 h-8 rounded-full border border-[#7DE2A1]"
              />
            )}
            <div className="flex-1">
              {/* Token name with symbol */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{stream.token_name}</span>
                {stream.symbol && (
                  <span className="text-xs text-[#7DE2A1]">${stream.symbol}</span>
                )}
                {stream.is_verified && (
                  <CheckCircle className="h-3 w-3 text-[#7DE2A1]" />
                )}
              </div>
              {/* Streamer name */}
              <div className="text-xs text-[#9ca3af]">
                by {stream.creator_username || stream.streamer_name.slice(0, 12)}...
              </div>
            </div>
          </div>
        </div>

        {/* Stats row - CA, viewer count, and MCap on same line */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            onClick={handleCopyAddress}
            className="px-2.5 py-1 bg-[#181821]/90 hover:bg-[#181821] backdrop-blur-sm rounded-lg flex items-center gap-1.5 transition-all group"
          >
            <Copy className="h-3 w-3 text-[#9ca3af] group-hover:text-[#7DE2A1]" />
            <span className="text-xs font-mono text-[#9ca3af] group-hover:text-white">
              {copied ? 'Copied!' : `${stream.token_address.slice(0, 4)}...${stream.token_address.slice(-4)}`}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 bg-[#181821]/90 backdrop-blur-sm rounded-lg flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-[#7DE2A1]" />
              <span className="text-xs font-medium text-white">{stream.viewer_count}</span>
            </div>
            {stream.usd_market_cap && (
              <div className="px-2.5 py-1 bg-[#181821]/90 backdrop-blur-sm rounded-lg">
                <span className="text-xs font-medium text-white">
                  MCap: {formatMarketCap(stream.usd_market_cap)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Social links at the bottom */}
        <div className="flex items-center justify-center gap-2">
          {stream.twitter && (
            <a
              href={stream.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-[#9ca3af] hover:text-[#7DE2A1] transition-all"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          )}
          {stream.telegram && (
            <a
              href={stream.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-[#9ca3af] hover:text-[#7DE2A1] transition-all"
            >
              <Send className="h-3 w-3" />
            </a>
          )}
          {stream.website && (
            <a
              href={stream.website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-[#9ca3af] hover:text-[#7DE2A1] transition-all"
            >
              <Globe className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Streamer controls */}
        {isStreamer && (
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
            <div className="px-2 py-1 bg-red-500 rounded text-white font-semibold animate-pulse text-xs">
              LIVE
            </div>
            <button
              onClick={onMicToggle}
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
              onClick={onLeaveStream}
              className="px-2 py-1 rounded-sm text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all flex items-center gap-1.5"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Leave</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}