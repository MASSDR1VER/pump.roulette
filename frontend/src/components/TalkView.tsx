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

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// LiveKit endpoint
const LIVEKIT_ENDPOINT = 'wss://pump-prod-tg2x8veh.livekit.cloud'

interface TalkViewProps {
  roomId: string
  token: string
  role: string
  onClose: () => void
}

type VerificationState = 'idle' | 'connecting' | 'verifying' | 'verified' | 'error'
type AudioState = 'disabled' | 'enabling' | 'enabled' | 'error'

export function TalkView({ roomId, token, role, onClose }: TalkViewProps) {
  // Wallet state
  const [wallet, setWallet] = useState<WalletConnection | null>(null)
  const [verificationState, setVerificationState] = useState<VerificationState>('idle')
  const [verificationError, setVerificationError] = useState<string | null>(null)

  // Audio state
  const [audioState, setAudioState] = useState<AudioState>('disabled')
  const [isMuted, setIsMuted] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [localTrack, setLocalTrack] = useState<LocalAudioTrack | null>(null)

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
      // Get nonce
      const nonceResponse = await fetch(`${API_BASE_URL}/auth/nonce`)
      const { nonce } = await nonceResponse.json()

      // Create message to sign
      const message = `PumpRoulette Audio Verification
Room: ${roomId}
Role: ${role}
Nonce: ${nonce}`

      // Sign message
      const signature = await signMessage(conn.provider, message)

      // Verify with backend - use audio_ prefix for the room ID
      const verifyResponse = await fetch(
        `${API_BASE_URL}/audio/rooms/audio_${roomId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey: conn.pubkey,
            role,
            signature,
            nonce
          })
        }
      )

      const verifyResult = await verifyResponse.json()

      if (verifyResult.ok && verifyResult.verified) {
        setVerificationState('verified')

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
    if (!roomId || !role || verificationState !== 'verified') return

    setAudioState('enabling')

    try {
      // Get publish token from backend
      const authToken = localStorage.getItem('auth_token')
      const response = await fetch(
        `${API_BASE_URL}/audio/rooms/${roomId}/creator-publish-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken ? `Bearer ${authToken}` : ''
          },
          body: JSON.stringify({ role })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get publish token')
      }

      const { publish_token } = await response.json()

      // Create and connect to LiveKit room
      const newRoom = createRoom()
      await connectToRoom(newRoom, LIVEKIT_ENDPOINT, publish_token)

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