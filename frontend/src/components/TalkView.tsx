/**
 * TalkView Component - Wallet-gated audio interface for streamers
 * Shown when room and token parameters are present in URL
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Room, LocalAudioTrack } from 'livekit-client'
import {
  Loader2,
  Mic,
  MicOff,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// Import helpers
import {
  connectPhantom,
  signMessage,
  disconnectWallet,
  isPhantomInstalled,
  WalletConnection
} from '@/lib/wallet'

import {
  createRoom,
  connectToRoom,
  createAudioTrack,
  publishAudioTrack,
  setupAudioListeners,
  disconnectFromRoom,
  setTrackMuted
} from '@/lib/livekit-audio'

import { config } from '@/lib/config'

// LiveKit endpoint
const LIVEKIT_ENDPOINT = 'wss://pump-udxzob1q.livekit.cloud'

interface TalkViewProps {
  roomId: string
  token?: string  // Optional now, will be fetched after wallet verification
  role: string
  onClose: () => void
  onAudioEnabled?: (enabled: boolean, token: string, roomId: string, endpoint: string) => void
}

type VerificationState = 'idle' | 'connecting' | 'verifying' | 'verified' | 'error'
type AudioState = 'disabled' | 'enabling' | 'enabled' | 'error'

export function TalkView({ roomId, token, role, onClose, onAudioEnabled }: TalkViewProps) {
  // Wallet state
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [verificationState, setVerificationState] = useState<VerificationState>('idle')
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [audioToken, setAudioToken] = useState<string | null>(token || null)
  const [audioEndpoint, setAudioEndpoint] = useState<string>(LIVEKIT_ENDPOINT)

  // Audio state
  const [audioState, setAudioState] = useState<AudioState>('disabled')
  const [isMuted, setIsMuted] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [localTrack, setLocalTrack] = useState<LocalAudioTrack | null>(null)

  // Check if this is a streamer role
  const isStreamer = role === 'streamer_a' || role === 'streamer_b'

  // Auto-connect for streamers
  useEffect(() => {
    if (isStreamer && verificationState === 'idle') {
      handleConnectWallet()
    }
  }, [isStreamer])

  // Auto-enable audio after verification for streamers
  useEffect(() => {
    if (isStreamer && verificationState === 'verified' && audioState === 'disabled') {
      handleEnableAudio()
    }
  }, [isStreamer, verificationState, audioState])

  // Connect wallet
  const handleConnectWallet = async () => {
    if (!isPhantomInstalled()) {
      setVerificationError('Please install Phantom wallet')
      return
    }

    setVerificationState('connecting')
    setVerificationError(null)

    try {
      const connection = await connectPhantom()
      setWallet(connection)
      setVerificationState('idle')

      // Automatically start verification after connection
      await handleVerifyWallet(connection)
    } catch (error) {
      console.error('Wallet connection error:', error)
      setVerificationError('Failed to connect wallet')
      setVerificationState('error')
    }
  }

  // Verify wallet ownership
  const handleVerifyWallet = async (walletConnection?: WalletConnection) => {
    const conn = walletConnection || wallet
    if (!conn || !roomId || !role) return

    setVerificationState('verifying')
    setVerificationError(null)

    try {
      // Create message to sign with local nonce
      const nonce = Math.floor(Math.random() * 1000000).toString()
      const message = `Verify wallet for PumpRoulette room ${roomId} with nonce ${nonce}`

      // Sign the message (returns base64 string)
      const signature = await signMessage(conn.provider, message)

      // Verify with backend - new room/verify endpoint
      const verifyResponse = await fetch(
        `${config.api.baseUrl}/api/v1/audio/room/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey: conn.pubkey,
            room_id: roomId,
            role,
            signature, // Already in base64 format from signMessage
            nonce,
            token: token // Include token if provided for recovery
          })
        }
      )

      const verifyResult = await verifyResponse.json()

      if (verifyResult.success) {
        setVerificationState('verified')
        // Store the token and endpoint received from backend
        setAudioToken(verifyResult.token)
        setAudioEndpoint(verifyResult.audio_endpoint || LIVEKIT_ENDPOINT)

        // Store auth token if returned
        if (verifyResult.token) {
          localStorage.setItem('auth_token', verifyResult.token)
        }
      } else {
        setVerificationError(verifyResult.error || 'Verification failed')
        setVerificationState('error')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationError('Failed to verify wallet ownership')
      setVerificationState('error')
    }
  }

  // Enable audio
  const handleEnableAudio = async () => {
    if (!roomId || !role || verificationState !== 'verified' || !audioToken) return

    setAudioState('enabling')

    try {
      // Use the token we got from wallet verification
      // No need to get another token, we already have it from room/verify

      // Create and connect to LiveKit room
      const newRoom = createRoom()
      await connectToRoom(newRoom, audioEndpoint, audioToken)

      // Create and publish audio track
      const audioTrack = await createAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      })

      await publishAudioTrack(newRoom, audioTrack)

      // Set up listeners for remote tracks
      setupAudioListeners(newRoom)

      setRoom(newRoom)
      setLocalTrack(audioTrack)
      setAudioState('enabled')

      // Notify parent component that audio is enabled
      console.log('🎤 TalkView: Calling onAudioEnabled callback', { audioToken, roomId, audioEndpoint })
      if (onAudioEnabled) {
        onAudioEnabled(true, audioToken, roomId, audioEndpoint)
      } else {
        console.log('⚠️ TalkView: onAudioEnabled callback not provided')
      }

    } catch (error) {
      console.error('Failed to enable audio:', error)
      setAudioState('error')
    }
  }

  // Toggle mute
  const handleToggleMute = () => {
    if (localTrack) {
      setTrackMuted(localTrack, !isMuted)
      setIsMuted(!isMuted)
    }
  }

  // Leave room
  const handleLeaveRoom = async () => {
    if (room && localTrack) {
      await disconnectFromRoom(room, localTrack)
      setRoom(null)
      setLocalTrack(null)
      setAudioState('disabled')
    }
    onClose()
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (room && localTrack) {
        disconnectFromRoom(room, localTrack)
      }
      if (wallet) {
        disconnectWallet(wallet.provider)
      }
    }
  }, [room, localTrack, wallet])


  // Streamers use the control bar for audio controls, so just return null when connected
  if (isStreamer && audioState === 'enabled') {
    return null
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <div className="text-center">

        {/* Not connected */}
        {!wallet && (
          <>
            <p className="text-white mb-4 text-sm">
              Connect Wallet to Join Audio
            </p>
            <button
              onClick={handleConnectWallet}
              disabled={verificationState === 'connecting'}
              className="px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black font-semibold rounded-md disabled:opacity-50 transition-colors text-sm"
            >
              {verificationState === 'connecting' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
                  Connecting...
                </>
              ) : (
                'Connect Wallet'
              )}
            </button>
          </>
        )}

        {/* Verifying */}
        {verificationState === 'verifying' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7DE2A1]" />
            <p className="text-white text-sm">Verifying wallet ownership...</p>
          </>
        )}

        {/* Error */}
        {verificationError && (
          <div className="mb-3">
            <p className="text-red-400 text-xs mb-3">{verificationError}</p>
            <button
              onClick={handleConnectWallet}
              className="px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black font-semibold rounded-md text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Verified - show audio controls */}
        {verificationState === 'verified' && (
          <>
            {audioState === 'disabled' && (
              <>
                <CheckCircle className="w-8 h-8 mx-auto mb-3 text-green-500" />
                <p className="text-white mb-3 text-sm">
                  Wallet verified! Enable your microphone to join
                </p>
                <button
                  onClick={handleEnableAudio}
                  className="px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black font-semibold rounded-md transition-colors text-sm"
                >
                  Enable Audio
                </button>
              </>
            )}

            {audioState === 'enabling' && (
              <>
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7DE2A1]" />
                <p className="text-white text-sm">Connecting to audio room...</p>
              </>
            )}

            {audioState === 'enabled' && (
              <>
                <div className="px-3 py-1.5 bg-red-500 rounded-md text-white font-semibold animate-pulse mb-3 text-sm">
                  LIVE
                </div>
                <p className="text-white mb-3 text-sm">
                  You're connected to the audio room
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleToggleMute}
                    className={`p-2 ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-[#7DE2A1]/20 text-[#7DE2A1]'} rounded-md transition-colors`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleLeaveRoom}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors text-sm"
                  >
                    Leave Room
                  </button>
                </div>
              </>
            )}

            {audioState === 'error' && (
              <>
                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-500" />
                <p className="text-red-400 mb-3 text-sm">Failed to connect to audio</p>
                <button
                  onClick={handleEnableAudio}
                  className="px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black font-semibold rounded-md text-sm"
                >
                  Retry
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}