'use client'

import { useState } from 'react'
import AudioRoom from '@/components/AudioRoom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Headphones, Copy, Check } from 'lucide-react'

export default function TestAudioPage() {
  const [mode, setMode] = useState<'streamer' | 'viewer' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Test token'ları - Backend'den aldığımız token'lar
  const STREAMER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aWRlbyI6eyJyb29tSm9pbiI6dHJ1ZSwicm9vbSI6ImF1ZGlvX3Rlc3QtcGFpci0yMDI1MDkxNi0wNDQ1MDciLCJjYW5QdWJsaXNoIjp0cnVlLCJjYW5TdWJzY3JpYmUiOnRydWUsImNhblB1Ymxpc2hEYXRhIjp0cnVlLCJoaWRkZW4iOmZhbHNlfSwibWV0YWRhdGEiOiJ7XCJyb2xlXCI6XCJzdHJlYW1lclwiLFwiZGlzcGxheV9uYW1lXCI6XCJBbGljZVwifSIsIm5hbWUiOiJBbGljZSIsImlzcyI6IkFQSXBhbm13WFpCNERBbyIsInN1YiI6ImFsaWNlLXdhbGxldC1hZGRyZXNzIiwiZXhwIjoxNzU3OTkwNzA3LCJuYmYiOjAsImlhdCI6MTc1Nzk4NzEwN30.Cd3aGLCJY3QD47wr73y0sjMyClqmB4U9_EzMGamLk4M"

  const VIEWER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2aWRlbyI6eyJyb29tSm9pbiI6dHJ1ZSwicm9vbSI6ImF1ZGlvX3Rlc3QtcGFpci0yMDI1MDkxNi0wNDQ1MDciLCJjYW5QdWJsaXNoIjpmYWxzZSwiY2FuU3Vic2NyaWJlIjp0cnVlLCJjYW5QdWJsaXNoRGF0YSI6ZmFsc2UsImhpZGRlbiI6dHJ1ZX0sIm1ldGFkYXRhIjoie1wicm9sZVwiOlwidmlld2VyXCJ9IiwibmFtZSI6IlZpZXdlciAtMTIzIiwiaXNzIjoiQVBJcGFubXdYWkI0REFvIiwic3ViIjoidGVzdC12aWV3ZXItMTIzIiwiZXhwIjoxNzU3OTkwNzA3LCJuYmYiOjAsImlhdCI6MTc1Nzk4NzEwN30.wjGwmDgPOqo-nShTNd_ve_77EKszN1xSpppzDgIKAaI"

  const ROOM_ID = "test-pair-20250916-044507"
  const LIVEKIT_URL = "wss://pump-udxzob1q.livekit.cloud"

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDisconnect = () => {
    setMode(null)
  }

  if (mode) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              onClick={() => setMode(null)}
              variant="outline"
              className="text-white border-white hover:bg-gray-800"
            >
              ← Back to Selection
            </Button>
          </div>

          <Card className="bg-gray-800 border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-white mb-4">
              {mode === 'streamer' ? '🎙️ Streamer Mode' : '🎧 Viewer Mode'}
            </h2>

            <AudioRoom
              roomId={ROOM_ID}
              token={mode === 'streamer' ? STREAMER_TOKEN : VIEWER_TOKEN}
              role={mode}
              livekitUrl={LIVEKIT_URL}
              onDisconnect={handleDisconnect}
            />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          🎤 Audio Room Test
        </h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Streamer Card */}
          <Card className="bg-gray-800 border-gray-700 p-6 hover:border-blue-500 transition-all cursor-pointer"
                onClick={() => setMode('streamer')}>
            <div className="flex flex-col items-center text-center">
              <Mic className="w-16 h-16 text-blue-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Streamer Mode</h2>
              <p className="text-gray-400 mb-4">
                Join as a streamer with full audio publishing capabilities
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Join as Streamer
              </Button>
            </div>
          </Card>

          {/* Viewer Card */}
          <Card className="bg-gray-800 border-gray-700 p-6 hover:border-green-500 transition-all cursor-pointer"
                onClick={() => setMode('viewer')}>
            <div className="flex flex-col items-center text-center">
              <Headphones className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Viewer Mode</h2>
              <p className="text-gray-400 mb-4">
                Join as a viewer to listen to the audio stream
              </p>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Join as Viewer
              </Button>
            </div>
          </Card>
        </div>

        {/* Test Info */}
        <Card className="bg-gray-800 border-gray-700 p-6">
          <h3 className="text-xl font-bold text-white mb-4">Test Information</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <div>
                <p className="text-sm text-gray-400">Room ID</p>
                <p className="text-white font-mono">{ROOM_ID}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(ROOM_ID, 'room')}
                className="text-white hover:bg-gray-600"
              >
                {copied === 'room' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
              <div>
                <p className="text-sm text-gray-400">LiveKit URL</p>
                <p className="text-white font-mono text-xs">{LIVEKIT_URL}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(LIVEKIT_URL, 'url')}
                className="text-white hover:bg-gray-600"
              >
                {copied === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600 rounded">
            <p className="text-yellow-500 text-sm">
              <strong>Test Instructions:</strong>
            </p>
            <ol className="text-yellow-500 text-sm mt-2 space-y-1">
              <li>1. Open this page in two different browser tabs</li>
              <li>2. Join as Streamer in the first tab</li>
              <li>3. Join as Viewer in the second tab</li>
              <li>4. Speak in the Streamer tab and verify audio in Viewer tab</li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  )
}