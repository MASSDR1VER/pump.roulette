'use client'

import { useEffect, useState, useRef } from 'react'
import { Room, RoomEvent, Track, ConnectionState, LocalParticipant, RemoteParticipant, LogLevel, setLogLevel } from 'livekit-client'
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Users, Signal } from 'lucide-react'

// Enable detailed logging for debugging
if (typeof window !== 'undefined') {
  setLogLevel(LogLevel.debug)
}

interface AudioRoomProps {
  roomId: string
  token: string
  role: 'streamer' | 'viewer' | 'moderator'
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
  const [room, setRoom] = useState<Room | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent')

  const roomRef = useRef<Room | null>(null)
  const audioContext = useRef<AudioContext | null>(null)
  const analyser = useRef<AnalyserNode | null>(null)
  const animationFrame = useRef<number | null>(null)

  // Initialize LiveKit room
  useEffect(() => {
    if (!token || !roomId) return

    const initRoom = async () => {
      try {
        console.log('Initializing LiveKit room...')
        console.log('Token:', token?.substring(0, 50) + '...')
        console.log('Room ID:', roomId)
        console.log('LiveKit URL:', livekitUrl)
        console.log('Role:', role)

        setIsConnecting(true)
        setConnectionError(null)

        const newRoom = new Room({
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 48000,
          },
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            audioPreset: {
              maxBitrate: 64000,
            }
          }
        })

        roomRef.current = newRoom
        setRoom(newRoom)

        // Set up room event handlers
        newRoom.on(RoomEvent.Connected, () => {
          console.log('Connected to audio room')
          setIsConnected(true)
          setIsConnecting(false)

          // Request mic permission for streamers and moderators
          if (role === 'streamer' || role === 'moderator') {
            requestMicPermission()
          }
        })

        newRoom.on(RoomEvent.Disconnected, () => {
          console.log('Disconnected from audio room')
          setIsConnected(false)
          handleDisconnect()
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
          updateParticipants()
        })

        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          console.log('Participant disconnected:', participant.identity)
          updateParticipants()
        })

        newRoom.on(RoomEvent.TrackMuted, (track, participant) => {
          if (track.kind === Track.Kind.Audio) {
            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.TrackUnmuted, (track, participant) => {
          if (track.kind === Track.Kind.Audio) {
            updateParticipants()
          }
        })

        newRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          console.log('Audio playback status changed')
        })

        // Connect to room using provided LiveKit URL
        console.log('Attempting to connect to LiveKit...')

        try {
          await newRoom.connect(livekitUrl, token, {
            autoSubscribe: true,
          })
          console.log('Successfully connected to LiveKit!')
        } catch (connectError) {
          console.error('Connection failed:', connectError)
          throw connectError
        }

        // Initialize audio context for level monitoring
        if (role === 'streamer' || role === 'moderator') {
          initAudioAnalyser(newRoom.localParticipant)
        }

      } catch (error) {
        console.error('Failed to connect to audio room:', error)
        if (error instanceof Error) {
          console.error('Error name:', error.name)
          console.error('Error message:', error.message)
          console.error('Error stack:', error.stack)
          setConnectionError(`Connection failed: ${error.message}`)
        } else {
          setConnectionError('Failed to connect to audio room')
        }
        setIsConnecting(false)
      }
    }

    initRoom()

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
      }
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [token, roomId, role])

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

    // Add remote participants
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
      {(role === 'streamer' || role === 'moderator') && (
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

      {/* Viewer Controls */}
      {role === 'viewer' && (
        <div className="flex items-center justify-center space-x-4 pt-4 border-t border-gray-800">
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
            className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors"
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