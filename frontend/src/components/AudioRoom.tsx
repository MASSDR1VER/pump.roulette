'use client'

import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent, Track, ConnectionState, LocalParticipant, RemoteParticipant, LogLevel, setLogLevel } from 'livekit-client'
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Users, Signal, Headphones } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// Enable detailed logging for debugging
if (typeof window !== 'undefined') {
  setLogLevel(LogLevel.debug)
}

interface AudioRoomProps {
  roomId: string
  token: string
  role: 'streamer' | 'viewer' | 'moderator' | 'listener'
  livekitUrl?: string
  onDisconnect?: () => void
  onParticipantsChange?: (participants: ParticipantInfo[]) => void
}

interface ParticipantInfo {
  id: string
  name: string
  isMuted: boolean
  isSpeaking: boolean
  audioLevel: number
}

export default function AudioRoom({ roomId, token, role, livekitUrl = 'wss://pump-udxzob1q.livekit.cloud', onDisconnect, onParticipantsChange }: AudioRoomProps) {
  console.log('AudioRoom component mounted with:', { roomId, token: token ? 'exists' : 'null', role, livekitUrl })
  const { toast } = useToast()
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent')
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  const roomRef = useRef<Room | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const animationFrame = useRef<number | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasStartedConnection = useRef(false)
  const lastTokenRef = useRef<string | null>(null)

  // Initialize LiveKit room
  useEffect(() => {
    console.log('🔵 AudioRoom useEffect triggered:', {
      hasToken: !!token,
      tokenLength: token?.length,
      roomId,
      role,
      livekitUrl
    })

    // If no token, don't try to connect (viewer waiting for streamers)
    if (!token) {
      console.log('No token available - waiting for streamers to join')
      return
    }

    if (!roomId) {
      console.log('⚠️ No roomId available, skipping connection')
      return
    }

    // Prevent duplicate connections with same token
    if (lastTokenRef.current === token) {
      console.log('⚠️ Same token already processed, skipping duplicate connection')
      return
    }

    // Prevent duplicate connections
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      console.log('⚠️ Already connected, skipping duplicate connection')
      return
    }

    // Check if connection is already in progress
    if (hasStartedConnection.current && isConnecting) {
      console.log('⚠️ Connection already in progress, skipping duplicate')
      return
    }

    const initRoom = async () => {
      hasStartedConnection.current = true
      lastTokenRef.current = token // Store the token to prevent duplicate processing
      // Check if we've exceeded retry limit BEFORE trying
      if (retryCount >= MAX_RETRIES) {
        console.log('Max retries reached, stopping connection attempts')
        setConnectionError('Connection failed after multiple attempts. Please refresh and try again.')
        setIsConnecting(false)
        return
      }

      try {
        console.log('🟢 Initializing LiveKit room connection...')
        console.log('Token:', token?.substring(0, 50) + '...')
        console.log('Room ID:', roomId)
        console.log('LiveKit URL:', livekitUrl)
        console.log('Role:', role)
        console.log('Retry attempt:', retryCount + 1, '/', MAX_RETRIES)

        setIsConnecting(true)
        setConnectionError(null)

        const newRoom = new Room({
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          adaptiveStream: true,
          dynacast: true,
        })

        roomRef.current = newRoom
        setRoom(newRoom)

        // Set up room event handlers
        newRoom.on(RoomEvent.Connected, () => {
          console.log('Connected to audio room')
          setIsConnected(true)
          setIsConnecting(false)

          // Start audio playback for viewers/listeners
          if (role === 'viewer' || role === 'listener') {
            console.log('🎧 Starting audio playback for viewer/listener')
            newRoom.startAudio().then(() => {
              console.log('✅ Audio playback enabled')
            }).catch(err => {
              console.warn('⚠️ Audio playback requires user interaction:', err)
            })
          }

          // Request mic permission for streamers and moderators
          if (role === 'streamer' || role === 'moderator' ||
              role === 'streamer_a' || role === 'streamer_b') {
            requestMicPermission()
          }
        })

        newRoom.on(RoomEvent.Disconnected, (reason?: any) => {
          console.log('⚠️ Disconnected from audio room:', { reason, role, token: token?.substring(0, 20) })
          setIsConnected(false)
          // Don't immediately trigger onDisconnect for connection issues
          // This prevents the button from disappearing on temporary disconnects
        })

        newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          if (participant === newRoom.localParticipant) {
            if (quality >= 4) setConnectionQuality('excellent')
            else if (quality >= 2) setConnectionQuality('good')
            else setConnectionQuality('poor')
          }
        })

        newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          console.log('Participant connected:', participant.identity)

          // Parse participant metadata
          let metadata = {}
          try {
            metadata = participant.metadata ? JSON.parse(participant.metadata) : {}
          } catch (e) {
            console.log('Failed to parse metadata:', participant.metadata)
          }
          const participantRole = metadata.role || ''

          // Notify viewers when a streamer joins
          if ((participantRole === 'streamer' || participantRole.includes('streamer') ||
               participant.identity?.includes('Streamer')) &&
              (role === 'viewer' || role === 'listener')) {
            toast({
              title: "Streamer joined!",
              description: `${participant.name || participant.identity} has joined the audio room`,
            })
          }

          updateParticipants()
        })

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('Participant disconnected:', participant.identity)
          updateParticipants()
        })

        // CRITICAL: Subscribe to audio tracks to hear them
        newRoom.on(RoomEvent.TrackSubscribed, (
          track,
          publication,
          participant
        ) => {
          // Parse participant metadata to understand their role
          let participantMetadata: any = {}
          try {
            if (participant.metadata) {
              participantMetadata = JSON.parse(participant.metadata)
            }
          } catch (e) {
            console.log('Failed to parse participant metadata')
          }

          console.log('🔊 Track subscribed:', {
            trackKind: track.kind,
            participantIdentity: participant.identity,
            participantName: participant.name,
            participantMetadata: participantMetadata,
            localIdentity: newRoom.localParticipant?.identity,
            isLocal: participant === newRoom.localParticipant,
            isMuted: track.isMuted,
            trackSid: track.sid
          })

          if (track.kind === Track.Kind.Audio) {
            console.log(`🔊 Subscribed to ${participant.identity}'s audio track`, {
              trackMuted: track.isMuted,
              publicationMuted: publication.isMuted,
              trackSource: track.source,
              trackKind: track.kind,
              participantRole: participantMetadata.role
            })

            // Check if audio element already exists for this track
            const existingElement = document.querySelector(`[data-track-sid="${track.sid}"]`)
            if (existingElement) {
              console.log('⚠️ Audio element already exists for track:', track.sid, 'removing old one')
              existingElement.remove()
            }

            // Simply attach the audio element like the test HTML does
            const audioElement = track.attach()
            audioElement.style.display = 'none'

            // IMPORTANT: Check if the track should be muted based on publication state
            // LiveKit sometimes doesn't properly sync the mute state
            if (publication.isMuted || track.isMuted) {
              audioElement.muted = true
              console.log('🔇 Muting audio element because track/publication is muted')
            }

            // Store reference for cleanup
            audioElement.dataset.trackSid = track.sid
            audioElement.dataset.participantId = participant.identity

            // Add to DOM
            document.body.appendChild(audioElement)

            // Debug: Check the actual audio element state
            console.log('✅ Audio element attached for:', participant.identity, {
              audioElementMuted: audioElement.muted,
              audioElementVolume: audioElement.volume,
              audioElementPaused: audioElement.paused,
              hasSourceObject: !!audioElement.srcObject
            })

            // Debug: Listen for audio element events
            audioElement.addEventListener('play', () => {
              console.log('🎵 Audio started playing for:', participant.identity)
            })

            audioElement.addEventListener('pause', () => {
              console.log('⏸️ Audio paused for:', participant.identity)
            })

            audioElement.addEventListener('volumechange', () => {
              console.log('🔊 Volume changed for:', participant.identity, 'muted:', audioElement.muted)
            })

            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.TrackUnsubscribed, (
          track,
          publication,
          participant
        ) => {
          console.log('Track unsubscribed:', participant.identity)

          if (track.kind === Track.Kind.Audio) {
            // Detach and clean up audio element properly
            track.detach()

            // Clean up audio element from DOM
            const elements = document.querySelectorAll(`[data-track-sid="${track.sid}"]`)
            elements.forEach(el => {
              if (el instanceof HTMLAudioElement) {
                el.pause()
                el.srcObject = null
                el.src = ''
              }
              el.remove()
            })
            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
          console.log('🔇 Track muted event:', {
            participant: participant.identity,
            trackSid: publication.trackSid,
            kind: publication.kind,
            isMuted: publication.isMuted
          })

          if (publication.kind === Track.Kind.Audio) {
            // Find and ACTUALLY mute the audio element
            const audioElement = document.querySelector(`[data-track-sid="${publication.trackSid}"]`) as HTMLAudioElement
            if (audioElement) {
              audioElement.muted = true
              console.log('🔇 Manually muted audio element for:', participant.identity, {
                elementMuted: audioElement.muted,
                elementPaused: audioElement.paused,
                elementVolume: audioElement.volume
              })
            }
            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          console.log('🔊 Track unmuted event:', {
            participant: participant.identity,
            trackSid: publication.trackSid,
            kind: publication.kind,
            isMuted: publication.isMuted
          })

          if (publication.kind === Track.Kind.Audio) {
            // Find and ACTUALLY unmute the audio element
            const audioElement = document.querySelector(`[data-track-sid="${publication.trackSid}"]`) as HTMLAudioElement
            if (audioElement) {
              audioElement.muted = false
              console.log('🔊 Manually unmuted audio element for:', participant.identity, {
                elementMuted: audioElement.muted,
                elementPaused: audioElement.paused,
                elementVolume: audioElement.volume
              })
            }
            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          console.log('Audio playback status changed, can play audio:', newRoom.canPlaybackAudio)
          if (!newRoom.canPlaybackAudio) {
            console.log('⚠️ Audio playback blocked - user interaction required')
            // Try to start audio playback
            newRoom.startAudio().then(() => {
              console.log('✅ Audio playback started after user interaction')
            }).catch(err => {
              console.error('❌ Failed to start audio playback:', err)
            })
          }
        })

        // Connect to room using provided LiveKit URL
        console.log('Attempting to connect to LiveKit...')

        try {
          console.log('Attempting connection with:')
          console.log('- URL:', livekitUrl)
          console.log('- Token (first 50 chars):', token.substring(0, 50) + '...')
          console.log('- Token length:', token.length)

          // Parse JWT to see token contents (for debugging)
          try {
            const tokenParts = token.split('.')
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]))
              console.log('Token payload:', payload)
              console.log('Token room:', payload.video?.room)
              console.log('Token permissions:', {
                canPublish: payload.video?.canPublish,
                canSubscribe: payload.video?.canSubscribe
              })
            }
          } catch (e) {
            console.error('Failed to parse token:', e)
          }

          await newRoom.connect(livekitUrl, token, {
            autoSubscribe: true,
            reconnect: false, // Disable auto-reconnect to prevent spam
            stopLocalTrackOnUnpublish: true,
          })
          console.log('Successfully connected to LiveKit!')
          hasStartedConnection.current = false // Reset flag on success
        } catch (connectError: any) {
          console.error('Connection failed:', connectError)
          hasStartedConnection.current = false // Reset flag on failure
          console.error('Connection error details:', {
            message: connectError.message,
            code: connectError.code,
            name: connectError.name,
            url: livekitUrl,
            tokenLength: token?.length,
            stack: connectError.stack
          })

          // Specific error handling
          if (connectError.message?.includes('Client initiated disconnect')) {
            console.error('Client initiated disconnect - possible token or permission issue')

            // Retry logic with exponential backoff
            if (retryCount < MAX_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Max 10 seconds
              console.log(`Retrying connection in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
              setConnectionError(`Connection failed. Retrying in ${Math.floor(delay/1000)} seconds...`)
              setRetryCount(prev => prev + 1)

              // Clear any existing retry timeout
              if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
              }

              // Schedule retry
              retryTimeoutRef.current = setTimeout(() => {
                console.log('Retrying connection...')
                initRoom() // Call initRoom instead of connectToRoom
              }, delay)

              return // Don't throw error yet
            } else {
              setConnectionError('Connection failed after multiple attempts. Please refresh and try again.')
            }
          } else if (connectError.code === 401) {
            console.error('Authentication failed - invalid token')
            setConnectionError('Authentication failed. Please try reconnecting.')
          } else {
            setConnectionError(`Connection failed: ${connectError.message}`)
          }

          throw connectError
        }

        // Initialize audio context for level monitoring (only for streamers)
        if (role === 'streamer') {
          initAudioAnalyser(newRoom.localParticipant)
        }

      } catch (error) {
        console.error('Failed to connect to audio room:', error)
        if (error instanceof Error) {
          console.error('Error name:', error.name)
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)

          // More specific error messages
          if (error.message?.includes('disconnect')) {
            console.error('Connection was disconnected - check token validity and permissions')
          } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
            console.error('Authorization error - token may be invalid or expired')
          } else if (error.message?.includes('network')) {
            console.error('Network error - check LiveKit URL and connectivity')
          }

          // Don't overwrite existing connection error if already set
          if (!connectionError) {
            setConnectionError(`Connection failed: ${error.message}`)
          }
        } else {
          setConnectionError('Failed to connect to audio room')
        }
        setIsConnecting(false)
      }
    }

    initRoom()

    return () => {
      console.log('🔴 Cleaning up AudioRoom')
      hasStartedConnection.current = false
      // Don't clear lastTokenRef here - we want to prevent reconnection with same token

      // Clean up audio elements properly
      const audioElements = document.querySelectorAll('[data-track-sid]')
      audioElements.forEach(el => {
        if (el instanceof HTMLAudioElement) {
          el.pause()
          el.srcObject = null
          el.src = ''
        }
        el.remove()
      })

      if (roomRef.current) {
        roomRef.current.disconnect()
      }
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [token, roomId, role])

  // Reset retry count when token changes (new connection attempt)
  useEffect(() => {
    setRetryCount(0)
  }, [token])

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())

      // Enable microphone for streaming
      if (roomRef.current?.localParticipant) {
        await roomRef.current.localParticipant.setMicrophoneEnabled(true)
      }
    } catch (error) {
      console.error('Microphone permission denied:', error)
      setConnectionError('Microphone permission required for streaming')
    }
  }

  const initAudioAnalyser = (participant: LocalParticipant) => {
    if (!participant.audioTracks.size) return

    audioContext.current = new AudioContext()
    analyser.current = audioContext.current.createAnalyser()
    analyser.current.fftSize = 256

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount)

    const updateLevel = () => {
      if (!analyser.current) return

      analyser.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      setAudioLevel(average / 255)

      animationFrame.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  const updateParticipants = () => {
    if (!roomRef.current) return

    const participantList: ParticipantInfo[] = []

    // Add local participant if streamer or moderator
    if ((role === 'streamer' || role === 'moderator') && roomRef.current.localParticipant) {
      const local = roomRef.current.localParticipant
      participantList.push({
        id: local.identity,
        name: local.name || 'You',
        isMuted: local.audioTracks.size === 0 || Array.from(local.audioTracks.values())[0]?.isMuted || false,
        isSpeaking: false,
        audioLevel: audioLevel
      })
    }

    // Add remote participants - check if participants exists
    if (roomRef.current.participants) {
      roomRef.current.participants.forEach((participant) => {
        const audioTrack = Array.from(participant.audioTracks.values())[0]
        participantList.push({
          id: participant.identity,
          name: participant.name || participant.identity,
          isMuted: !audioTrack || audioTrack.isMuted,
          isSpeaking: participant.isSpeaking,
          audioLevel: 0
        })
      })
    }

    setParticipants(participantList)

    // Notify parent component of participant changes
    if (onParticipantsChange) {
      onParticipantsChange(participantList)
    }
  }

  const toggleMute = async () => {
    if (!roomRef.current?.localParticipant || (role !== 'streamer' && role !== 'moderator')) return

    const newMutedState = !isMuted
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMutedState)
    setIsMuted(newMutedState)
    updateParticipants()
  }

  const toggleDeafen = () => {
    if (!roomRef.current) return

    const newDeafenState = !isDeafened
    roomRef.current.participants.forEach(participant => {
      participant.audioTracks.forEach(track => {
        const audioElement = track.track?.attach()
        if (audioElement && audioElement instanceof HTMLAudioElement) {
          audioElement.muted = newDeafenState
        }
      })
    })
    setIsDeafened(newDeafenState)
  }

  const handleDisconnect = () => {
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
    setIsConnected(false)
    onDisconnect?.()
  }

  const getQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-500'
      case 'good': return 'text-yellow-500'
      case 'poor': return 'text-red-500'
    }
  }

  // Show waiting state if no token (viewer waiting for streamers)
  if (!token && role === 'viewer') {
    return (
      <div className="bg-gray-900 rounded-lg p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <Headphones className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          </div>
          <p className="text-gray-400 mb-2">Waiting for streamers to join...</p>
          <p className="text-gray-500 text-sm">You'll be connected automatically when a streamer joins</p>
        </div>
      </div>
    )
  }

  if (isConnecting) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to audio room...</p>
        </div>
      </div>
    )
  }

  if (connectionError) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="text-center">
          <p className="text-red-500 mb-4">{connectionError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // For viewers, don't render any UI - just handle the connection
  if (role === 'viewer' || role === 'listener') {
    return null
  }

  // Only render UI for streamers
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Signal className={`w-4 h-4 ${getQualityColor()}`} />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">{participants.length}</span>
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-2 mb-4">
        {/* Show waiting message for viewers if no streamers */}
        {(role === 'viewer' || role === 'listener') && participants.length === 0 && (
          <div className="p-4 bg-gray-800 rounded-lg text-center">
            <div className="animate-pulse mb-2">
              <Users className="w-8 h-8 text-gray-500 mx-auto" />
            </div>
            <p className="text-sm text-gray-400">Waiting for streamers to join...</p>
            <p className="text-xs text-gray-500 mt-1">You'll hear them once they connect</p>
          </div>
        )}
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                {participant.isSpeaking && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{participant.name}</p>
                {participant.isMuted && (
                  <p className="text-xs text-gray-500">Muted</p>
                )}
              </div>
            </div>
            {participant.isSpeaking && !participant.isMuted && (
              <div className="flex space-x-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-green-500 rounded-full animate-pulse"
                    style={{
                      height: `${8 + Math.random() * 12}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  ></div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      {(role === 'streamer' || role === 'moderator' || role === 'streamer_a' || role === 'streamer_b') && (
        <div className="flex items-center justify-center space-x-4 pt-4 border-t border-gray-800">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleDeafen}
            className={`p-3 rounded-full transition-colors ${
              isDeafened ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            onClick={handleDisconnect}
            className="p-3 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}


      {/* Audio Level Indicator for Streamer */}
      {(role === 'streamer' || role === 'moderator') && !isMuted && (
        <div className="mt-4 px-4">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}