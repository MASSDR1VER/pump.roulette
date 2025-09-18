'use client'

import { useState, useEffect } from 'react'
import { config } from '@/lib/config'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Loader2,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Zap,
  Volume2,
  Users,
  Video,
  VideoOff
} from 'lucide-react'

interface AudioRoom {
  room_id: string
  access_token: string
  room_config: {
    livekit_url: string
    room_name: string
    participant_count: number
  }
}

export default function StreamerPage() {
  const { user, connectWallet, isConnecting, error: authError, isWalletConnected } = useAuth()
  const { toast } = useToast()

  const [audioRoom, setAudioRoom] = useState<AudioRoom | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)

  const roomId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('room') : null

  useEffect(() => {
    if (authError) {
      toast({
        title: "Authentication failed",
        description: authError,
        variant: "destructive"
      })
    }
  }, [authError, toast])

  const joinAudioRoom = async () => {
    if (!isWalletConnected || !roomId) return

    setIsJoining(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${config.api.baseUrl}/api/v1/audio/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_id: roomId,
          role: 'participant'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAudioRoom({
          room_id: roomId,
          access_token: data.access_token,
          room_config: data.room_config
        })
        setIsConnected(true)
        toast({
          title: "Joined audio room",
          description: "You're now connected to the audio conversation.",
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to join audio room')
      }
    } catch (error: any) {
      console.error('Failed to join audio room:', error)
      toast({
        title: "Failed to join room",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsJoining(false)
    }
  }

  const leaveAudioRoom = async () => {
    if (!audioRoom) return

    try {
      const token = localStorage.getItem('auth_token')
      await fetch(`${config.api.baseUrl}/api/v1/audio/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          room_id: audioRoom.room_id
        })
      })

      setAudioRoom(null)
      setIsConnected(false)
      toast({
        title: "Left audio room",
        description: "You've disconnected from the conversation.",
      })
    } catch (error) {
      console.error('Failed to leave audio room:', error)
    }
  }

  return (
    <div className="min-h-screen bg-[#15161B] text-white">
      {/* Header */}
      <header className="h-14 bg-[#181821] border-b border-[#25262b] flex-shrink-0">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-[#7DE2A1] font-bold text-xl flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Pump.roulette
            </div>
            <span className="text-sm text-gray-400">Streamer Portal</span>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#25262b] rounded-lg">
                <img
                  src={user.profile_image}
                  alt={user.display_name}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm">{user.display_name}</span>
                {isWalletConnected && user.is_verified && (
                  <CheckCircle className="h-4 w-4 text-[#7DE2A1]" />
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          {/* Status Card */}
          <div className="bg-[#181821] border border-[#25262b] rounded-xl p-6 mb-6">
            {!isWalletConnected ? (
              <>
                <div className="text-center mb-4">
                  <Wallet className="h-12 w-12 text-[#7DE2A1] mx-auto mb-3" />
                  <h2 className="text-xl font-bold mb-2">Connect Your Wallet</h2>
                  <p className="text-gray-400 text-sm">
                    Connect your Solana wallet to join audio conversations as a streamer.
                  </p>
                </div>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full px-4 py-3 bg-[#7DE2A1] hover:bg-[#6dd291] disabled:opacity-50 text-black font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="h-4 w-4" />
                      Connect Phantom Wallet
                    </>
                  )}
                </button>
              </>
            ) : !roomId ? (
              <>
                <div className="text-center mb-4">
                  <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                  <h2 className="text-xl font-bold mb-2">No Room Specified</h2>
                  <p className="text-gray-400 text-sm">
                    Please join through a valid room invitation link.
                  </p>
                </div>
              </>
            ) : !isConnected ? (
              <>
                <div className="text-center mb-4">
                  <Phone className="h-12 w-12 text-[#7DE2A1] mx-auto mb-3" />
                  <h2 className="text-xl font-bold mb-2">Ready to Join</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Join the audio conversation and start streaming.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-4">
                    <span>Room: {roomId.slice(0, 8)}...</span>
                  </div>
                </div>
                <button
                  onClick={joinAudioRoom}
                  disabled={isJoining}
                  className="w-full px-4 py-3 bg-[#7DE2A1] hover:bg-[#6dd291] disabled:opacity-50 text-black font-semibold rounded-lg transition-all flex items-center justify-center gap-2 mb-3"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4" />
                      Join Audio Room
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="relative mb-3">
                    <div className="w-12 h-12 bg-[#7DE2A1] rounded-full flex items-center justify-center mx-auto">
                      <Phone className="h-6 w-6 text-black" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <h2 className="text-xl font-bold mb-2">Connected</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    You're live in the audio conversation!
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{participantCount} participants</span>
                    </div>
                  </div>
                </div>

                {/* Audio Controls */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    className={`p-3 rounded-lg transition-all ${
                      micEnabled
                        ? 'bg-[#25262b] hover:bg-[#2a2b30] text-white'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    }`}
                  >
                    {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setVideoEnabled(!videoEnabled)}
                    className={`p-3 rounded-lg transition-all ${
                      videoEnabled
                        ? 'bg-[#25262b] hover:bg-[#2a2b30] text-white'
                        : 'bg-[#25262b] hover:bg-[#2a2b30] text-gray-400'
                    }`}
                  >
                    {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </button>
                  <button
                    className="p-3 bg-[#25262b] hover:bg-[#2a2b30] text-gray-400 rounded-lg transition-all"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>

                <button
                  onClick={leaveAudioRoom}
                  className="w-full px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  Leave Room
                </button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="text-center text-xs text-gray-500">
            <p>Make sure you have a good internet connection for the best streaming experience.</p>
          </div>
        </div>
      </div>
    </div>
  )
}