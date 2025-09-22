/**
 * LiveKit Stream Component
 * Displays Pump.fun live streams using LiveKit SDK
 */

import { useEffect, useRef, useState } from 'react'
import { Room, RoomEvent, Track, VideoPresets, RemoteTrack } from 'livekit-client'
import { Loader2, Volume2, VolumeX, Users, Copy, ExternalLink, Heart, Share2, Flame, Send, Globe, AlertTriangle, CheckCircle } from 'lucide-react'

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
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1` : 'https://app.pump-roulette.com/api/v1'

export function LiveKitStream({ stream, streamId, muted, onMuteChange }: LiveKitStreamProps) {
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

  useEffect(() => {
    // Use the access token from stream data if available
    const connectWithToken = async () => {
      // Prevent multiple simultaneous connections
      if (isConnecting || room?.state === 'connected') {
        console.log('Already connecting or connected, skipping...')
        return
      }

      try {
        setIsConnecting(true)
        setIsLoading(true)
        setError(null)

        let token = stream.access_token

        // Check if stream already has an access token
        if (token) {
          console.log('Using access token from stream data')
        } else {
          // Try to fetch a new token
          console.log('Fetching new access token for:', stream.token_address)
          const response = await fetch(`${API_BASE_URL}/streams/access-token/${stream.token_address}`)

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

          token = data.access_token
        }

        // Only connect if token has changed or we don't have a room
        if (token && (token !== currentToken || !room)) {
          setCurrentToken(token)
          await connectToRoom(token)
        }

      } catch (error) {
        console.error('Failed to connect to stream:', error)
        setError(error instanceof Error ? error.message : 'Unable to connect to stream')
        setIsLoading(false)
      } finally {
        setIsConnecting(false)
      }
    }

    // Connect if we have stream data and not already connected
    if (stream?.token_address && !room) {
      connectWithToken()
    } else if (!stream?.token_address) {
      setError('Stream information missing')
      setIsLoading(false)
    }

    return () => {
      // Only disconnect if component is unmounting
      if (room) {
        disconnect()
      }
    }
  }, [stream?.token_address, stream?.access_token]) // Only re-run when these specific values change

  const connectToRoom = async (token: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      })

      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connected to LiveKit room for stream:', streamId)
        console.log('Room participants:', newRoom.participants ? newRoom.participants.size : 0)
        console.log('Room state:', newRoom.state)
      })

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity, 'for stream:', streamId)
      })

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('Track published:', publication.trackName, 'by:', participant.identity, 'for stream:', streamId)
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track instanceof RemoteTrack) {
          if (track.kind === Track.Kind.Video) {
            console.log('Video track received for stream:', streamId)
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
              videoContainerRef.current.appendChild(element)

              console.log('Video element attached to DOM for stream:', streamId)
              setIsLoading(false)
            }
          } else if (track.kind === Track.Kind.Audio) {
            setAudioTracks(prev => [...prev, track])

            const element = track.attach() as HTMLAudioElement
            element.style.display = 'none'
            element.setAttribute('data-livekit', 'true')
            element.setAttribute('data-stream', streamId)
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

      await newRoom.connect(
        'wss://pump-prod-tg2x8veh.livekit.cloud',
        token,
        {
          autoSubscribe: true,
        }
      )

      setRoom(newRoom)

    } catch (err: any) {
      console.error('Failed to connect to room:', err)
      setError(err.message || 'Failed to connect to stream')
      setIsLoading(false)
    }
  }

  const disconnect = () => {
    const allTracks = audioTracks.concat(videoTracks)
    allTracks.forEach(track => {
      try {
        track.stop()
        track.detach()
      } catch (e) {
        console.error('Error stopping track:', e)
      }
    })

    setAudioTracks([])
    setVideoTracks([])

    if (room) {
      room.disconnect()
      room.removeAllListeners()
      setRoom(null)
    }

    if (videoContainerRef.current) {
      videoContainerRef.current.innerHTML = ''
    }

    const audioElements = document.querySelectorAll('audio[data-livekit]')
    audioElements.forEach(el => el.remove())
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
                // Retry by fetching a new token
                try {
                  setIsLoading(true)
                  setError(null)

                  const response = await fetch(`${API_BASE_URL}/streams/access-token/${stream.token_address}`)

                  if (!response.ok) {
                    throw new Error('Failed to get access token')
                  }

                  const data = await response.json()

                  if (data.access_token) {
                    await connectToRoom(data.access_token)
                  } else {
                    throw new Error('No access token available')
                  }
                } catch (err) {
                  console.error('Retry failed:', err)
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
      </div>
    </div>
  )
}