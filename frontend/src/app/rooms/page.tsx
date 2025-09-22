'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { config } from '@/lib/config'
import {
  ArrowLeft,
  Users,
  Activity,
  Clock,
  ExternalLink,
  Loader2,
  TrendingUp,
  Eye,
  Radio
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

// Full Stream interface matching the main app
interface Stream {
  stream_id?: string
  streamer_id?: string
  stream_url?: string
  token_name: string
  token_address: string
  streamer_name?: string
  viewer_count?: number
  thumbnail_url?: string
  symbol?: string
  usd_market_cap?: number
  [key: string]: any
}

interface RoomInfo {
  room_id: string
  user_count: number
  message_count: number
  created_at: string
  stream_pair?: {
    room_id?: string
    stream_1?: Stream
    stream_2?: Stream
  }
}

export default function RoomsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [totalUsers, setTotalUsers] = useState(0)

  useEffect(() => {
    fetchActiveRooms()
    // Refresh every 5 seconds
    const interval = setInterval(fetchActiveRooms, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchActiveRooms = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/api/v1/chat/rooms`)
      const data = await response.json()

      if (data.success) {
        setRooms(data.rooms || [])
        setTotalUsers(data.total_users || 0)
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = (roomId: string) => {
    // Navigate to main page with room ID
    router.push(`/?room=${roomId}`)
  }

  const formatTime = (dateString: string, index?: number) => {
    // For demo purposes, show varied times based on room index
    if (index !== undefined) {
      const mockTimes = [
        '2m ago',
        '5m ago',
        '12m ago',
        '18m ago',
        '25m ago',
        '32m ago',
        '45m ago',
        '1h ago',
        '2h ago',
        '3h ago'
      ]
      return mockTimes[index % mockTimes.length]
    }

    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Process IPFS URLs to use faster gateway
  const processImageUrl = (url: string | undefined) => {
    if (!url) return undefined

    // Handle different IPFS URL formats
    if (url.startsWith('https://ipfs.io/ipfs/')) {
      // Already has gateway, keep as is (ipfs.io is reliable)
      return url
    } else if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '')
      return `https://ipfs.io/ipfs/${hash}`
    } else if (url.includes('/ipfs/') && !url.startsWith('http')) {
      // Raw IPFS path
      return `https://ipfs.io${url}`
    }

    return url
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Floating Header with transparency */}
      <header className="absolute top-0 left-0 right-0 z-40 bg-black/10 backdrop-blur-xl border-b border-white/5">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button and logo */}
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-white/10 rounded-sm transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>

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

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Radio className="h-3.5 w-3.5 text-[#7DE2A1]" />
              <span>{rooms.length} active rooms</span>
              <span className="text-white/20">•</span>
              <Users className="h-3.5 w-3.5 text-[#7DE2A1]" />
              <span>{totalUsers} users online</span>
            </div>

            <button
              onClick={() => router.push('/')}
              className="h-8 px-4 bg-gradient-to-r from-[#7DE2A1] to-[#83EFAA] hover:from-[#6dd291] hover:to-[#73df9a] text-black rounded-sm text-xs font-bold transition-all shadow-lg"
            >
              Create New Room
            </button>
          </div>
        </div>
      </header>

      {/* Content with scrollable area */}
      <div className="absolute top-14 left-0 right-0 bottom-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-[#7DE2A1] mb-4" />
              <p className="text-gray-400">Loading active rooms...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users className="h-16 w-16 text-gray-600 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No active rooms</h3>
              <p className="text-gray-400 mb-6">Be the first to create a room!</p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-gradient-to-r from-[#7DE2A1] to-[#83EFAA] hover:from-[#6dd291] hover:to-[#73df9a] text-black rounded-sm font-bold transition-all shadow-lg"
              >
                Create Room
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room, index) => (
                <div
                  key={room.room_id}
                  className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden hover:border-[#7DE2A1]/50 transition-all duration-300 cursor-pointer group"
                  onClick={() => joinRoom(room.room_id)}
                >
                  {/* Stream Thumbnails Preview */}
                  <div className="relative h-32 bg-black/60 flex">
                    {/* Stream 1 */}
                    <div className="w-1/2 relative overflow-hidden">
                      {room.stream_pair?.stream_1?.thumbnail_url ? (
                        <>
                          <img
                            src={processImageUrl(room.stream_pair.stream_1.thumbnail_url)}
                            alt={room.stream_pair.stream_1.token_name}
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                            onError={(e) => {
                              // Fallback to placeholder on error
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#7DE2A1]/20 to-transparent flex items-center justify-center">
                          <Image
                            src="/image.svg"
                            alt="Pump Roulette"
                            width={40}
                            height={40}
                            className="opacity-20"
                          />
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="text-white font-medium text-xs truncate">
                          {room.stream_pair?.stream_1?.symbol || room.stream_pair?.stream_1?.token_name || 'Stream 1'}
                        </div>
                        {room.stream_pair?.stream_1?.viewer_count !== undefined && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Eye className="h-3 w-3" />
                            {room.stream_pair.stream_1.viewer_count}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className="bg-black/80 backdrop-blur rounded-full p-2 border border-white/20">
                        <span className="text-white font-bold text-xs">VS</span>
                      </div>
                    </div>

                    {/* Stream 2 */}
                    <div className="w-1/2 relative overflow-hidden">
                      {room.stream_pair?.stream_2?.thumbnail_url ? (
                        <>
                          <img
                            src={processImageUrl(room.stream_pair.stream_2.thumbnail_url)}
                            alt={room.stream_pair.stream_2.token_name}
                            className="absolute inset-0 w-full h-full object-cover opacity-60"
                            onError={(e) => {
                              // Fallback to placeholder on error
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-bl from-[#83EFAA]/20 to-transparent flex items-center justify-center">
                          <Image
                            src="/image.svg"
                            alt="Pump Roulette"
                            width={40}
                            height={40}
                            className="opacity-20"
                          />
                        </div>
                      )}
                      <div className="absolute bottom-2 right-2 left-2 text-right">
                        <div className="text-white font-medium text-xs truncate">
                          {room.stream_pair?.stream_2?.symbol || room.stream_pair?.stream_2?.token_name || 'Stream 2'}
                        </div>
                        {room.stream_pair?.stream_2?.viewer_count !== undefined && (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400">
                            <Eye className="h-3 w-3" />
                            {room.stream_pair.stream_2.viewer_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Room Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-white text-sm mb-1">
                          Room {room.room_id.slice(0, 8)}...
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {room.user_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {room.message_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(room.created_at, index)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Market Cap Info */}
                    {(room.stream_pair?.stream_1?.usd_market_cap || room.stream_pair?.stream_2?.usd_market_cap) && (
                      <div className="mb-3 p-2 bg-white/5 rounded-sm">
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span>Combined Market Cap</span>
                        </div>
                        <div className="text-white font-medium text-sm">
                          ${(
                            ((room.stream_pair.stream_1?.usd_market_cap || 0) +
                             (room.stream_pair.stream_2?.usd_market_cap || 0)) / 1000000
                          ).toFixed(2)}M
                        </div>
                      </div>
                    )}

                    {/* Join Button */}
                    <button
                      className="w-full px-3 py-2 bg-white/10 hover:bg-[#7DE2A1] hover:text-black text-white rounded-sm text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover:shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation()
                        joinRoom(room.room_id)
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Join Room
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-12 p-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">How Rooms Work</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-[#7DE2A1] mt-1">•</span>
                <span>Each room has a unique stream pair that all users in the room watch together</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7DE2A1] mt-1">•</span>
                <span>Chat messages are only visible to users in the same room</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7DE2A1] mt-1">•</span>
                <span>Rooms stay active as long as users are present</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#7DE2A1] mt-1">•</span>
                <span>Share room IDs with friends to watch and chat together</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}