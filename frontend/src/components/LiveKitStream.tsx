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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://app.pump-roulette.com/api/v1'

export function LiveKitStream({ stream, streamId, muted, onMuteChange }: LiveKitStreamProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [audioTracks, setAudioTracks] = useState<RemoteTrack[]>([])
  const [videoTracks, setVideoTracks] = useState<RemoteTrack[]>([])
  const [copied, setCopied] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    // Fetch individual token for this viewer
    const fetchTokenAndConnect = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch a unique access token for this viewer
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

        // Connect to room with the individual token
        await connectToRoom(data.access_token)

      } catch (error) {
        console.error('Failed to get access token:', error)
        setError(error instanceof Error ? error.message : 'Unable to connect to stream')
        setIsLoading(false)
      }
    }

    // Fetch a new token for this viewer if we have a token_address
    if (stream.token_address) {
      fetchTokenAndConnect()
    } else {
      setError('Stream information missing - token address required')
      setIsLoading(false)
    }

    return () => {
      disconnect()
    }
  }, [stream])

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
        console.log('Connected to LiveKit room')
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track instanceof RemoteTrack) {
          if (track.kind === Track.Kind.Video) {
            setVideoTracks(prev => [...prev, track])

            if (videoContainerRef.current) {
              videoContainerRef.current.innerHTML = ''
              const element = track.attach()
              element.className = 'w-full h-full object-contain'
              videoContainerRef.current.appendChild(element)
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
    <div className="flex-1 bg-[#181821] relative">
      {/* Video container */}
      <div ref={videoContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#15161B]/95">
          <div className="text-center bg-[#181821] rounded-lg p-6 border border-[#25262b]">
            <Loader2 className="w-10 h-10 animate-spin text-[#7DE2A1] mb-3 mx-auto" />
            <p className="text-white font-medium mb-1">Connecting to stream</p>
            <p className="text-[#9ca3af] text-sm">{stream.token_name}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#15161B]">
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

      {/* Top overlay - minimal badges only */}
      <div className="absolute top-0 left-0 right-0 p-3 flex justify-between">
        {/* Left side - Status badges */}
        <div className="flex items-start gap-2">
          <div className="px-2.5 py-1 bg-[#7DE2A1] rounded text-black text-xs font-bold flex items-center gap-1.5">
            LIVE
          </div>
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
              onClick={handleFavorite}
              className={`p-2 ${isFavorited ? 'bg-red-500/20 text-red-500' : 'bg-[#181821]/90 text-white'} hover:bg-[#181821] backdrop-blur-sm rounded-lg transition-all`}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 bg-[#181821]/90 hover:bg-[#181821] text-white backdrop-blur-sm rounded-lg transition-all relative"
            >
              <Share2 className="h-4 w-4" />
              {showShare && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-[#7DE2A1] text-black text-xs px-2 py-1 rounded whitespace-nowrap">
                  Link copied!
                </span>
              )}
            </button>
            <button
              onClick={handleOpenPumpFun}
              className="px-3 py-1.5 bg-[#7DE2A1] hover:bg-[#6dd291] text-black rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              pump.fun
            </button>
          </div>
      </div>

      {/* Bottom overlay with stream info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
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
            {/* Social links */}
            <div className="flex items-center gap-1.5">
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
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          {/* Left side - Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onMuteChange?.(!muted)}
              className="p-2 bg-[#181821]/90 hover:bg-[#181821] backdrop-blur-sm rounded-lg transition-all"
            >
              {muted ? <VolumeX className="h-4 w-4 text-[#9ca3af]" /> : <Volume2 className="h-4 w-4 text-[#7DE2A1]" />}
            </button>
          </div>

          {/* Right side - Stats and address */}
          <div className="flex flex-col items-end gap-2">
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
              {stream.holders && (
                <div className="px-2.5 py-1 bg-[#181821]/90 backdrop-blur-sm rounded-lg">
                  <span className="text-xs font-medium text-[#9ca3af]">
                    {stream.holders} holders
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleCopyAddress}
              className="px-2.5 py-1 bg-[#181821]/90 hover:bg-[#181821] backdrop-blur-sm rounded-lg flex items-center gap-1.5 transition-all group"
            >
              <Copy className="h-3 w-3 text-[#9ca3af] group-hover:text-[#7DE2A1]" />
              <span className="text-xs font-mono text-[#9ca3af] group-hover:text-white">
                {copied ? 'Copied!' : `${stream.token_address.slice(0, 4)}...${stream.token_address.slice(-4)}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}