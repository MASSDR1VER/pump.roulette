'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, Activity, Clock, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface RoomInfo {
  room_id: string
  user_count: number
  message_count: number
  created_at: string
  stream_pair?: {
    stream_1?: { token_address: string; symbol?: string; token_name?: string }
    stream_2?: { token_address: string; symbol?: string; token_name?: string }
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
      const response = await fetch('http://localhost:8000/api/v1/chat/rooms')
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="min-h-screen bg-[#15161B] text-white">
      {/* Header */}
      <header className="bg-[#181821] border-b border-[#25262b] p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-[#25262b] rounded-sm transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Active Rooms</h1>
              <p className="text-sm text-gray-400">
                {rooms.length} rooms • {totalUsers} users online
              </p>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#83EFAA] hover:bg-[#73df9a] text-black rounded-sm font-medium transition-colors"
          >
            Create New Room
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">Loading rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No active rooms</h3>
            <p className="text-gray-400 mb-6">Be the first to create a room!</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[#83EFAA] hover:bg-[#73df9a] text-black rounded-sm font-medium transition-colors"
            >
              Create Room
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className="bg-[#181821] border border-[#25262b] rounded-sm p-4 hover:border-[#83EFAA] transition-colors cursor-pointer"
                onClick={() => joinRoom(room.room_id)}
              >
                {/* Room Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-sm mb-1">
                      Room {room.room_id.slice(0, 8)}...
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {room.user_count} users
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {room.message_count} msgs
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(room.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stream Pair Info */}
                {room.stream_pair && (
                  <div className="border-t border-[#25262b] pt-3 mt-3">
                    <div className="text-xs text-gray-400 mb-2">Streams:</div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1 truncate">
                        <span className="text-white">
                          {room.stream_pair.stream_1?.symbol ||
                           room.stream_pair.stream_1?.token_name ||
                           'Stream 1'}
                        </span>
                      </div>
                      <span className="text-gray-500">vs</span>
                      <div className="flex-1 truncate">
                        <span className="text-white">
                          {room.stream_pair.stream_2?.symbol ||
                           room.stream_pair.stream_2?.token_name ||
                           'Stream 2'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Join Button */}
                <button
                  className="w-full mt-3 px-3 py-1.5 bg-[#25262b] hover:bg-[#83EFAA] hover:text-black text-white rounded-sm text-sm font-medium transition-all flex items-center justify-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    joinRoom(room.room_id)
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Join Room
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 p-6 bg-[#181821] border border-[#25262b] rounded-sm">
          <h3 className="text-lg font-semibold mb-3">How Rooms Work</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-[#83EFAA] mt-1">•</span>
              <span>Each room has a unique stream pair that all users in the room watch together</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#83EFAA] mt-1">•</span>
              <span>Chat messages are only visible to users in the same room</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#83EFAA] mt-1">•</span>
              <span>Rooms are automatically deleted when the last user leaves</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#83EFAA] mt-1">•</span>
              <span>Share room IDs with friends to watch and chat together</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}