'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, ExternalLink, Edit, LogOut, User, Wallet, Camera } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

export default function ProfilePage() {
  const { user, logout, isWalletConnected } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [showEditModal, setShowEditModal] = useState(false)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<'balances' | 'replies' | 'notifications'>('balances')

  useEffect(() => {
    // Remove the redirect check - allow viewing profile without wallet
    if (user) {
      setUsername(user.username || user.display_name || '')
      setBio(user.bio || '')
    }
  }, [user])

  const copyAddress = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address)
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      })
    }
  }

  const handleProfileUpdate = async () => {
    setIsUpdating(true)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('https://app.pump-roulette.com/api/v1/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          bio
        })
      })

      if (response.ok) {
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully",
        })
        setShowEditModal(false)
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#15161B] text-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please connect your wallet</h2>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-[#83EFAA] hover:bg-[#73df9a] text-black rounded-sm font-medium transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Generate crypto-style avatar URL
  const avatarUrl = `https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=93&img-dpr=2&img-onerror=redirect`

  return (
    <div className="min-h-screen bg-[#15161B] text-white">
      {/* Header */}
      <header className="bg-[#181821] border-b border-[#25262b] p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 hover:bg-[#25262b] rounded-sm transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold">Profile</h1>
        </div>
      </header>

      {/* Profile Info */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatarUrl}
                alt={user.display_name}
                className="w-24 h-24 rounded-full border-2 border-[#25262b]"
              />
              {user.is_verified && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{user.username || user.display_name}</h2>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1 bg-[#25262b] hover:bg-[#2a2b30] rounded-sm text-sm transition-colors"
                >
                  edit
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-gray-400 font-mono text-sm">
                  {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                </span>
                <button
                  onClick={copyAddress}
                  className="p-1 hover:bg-[#25262b] rounded-sm transition-colors"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <a
                  href={`https://solscan.io/account/${user.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  View on solscan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {user.bio && (
                <p className="text-gray-400 mt-2">{user.bio}</p>
              )}
            </div>
          </div>

          {/* Right side menu */}
          <div className="flex flex-col gap-2">
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-[#25262b] rounded-sm text-sm transition-colors">
              <User className="h-4 w-4" />
              Profile
            </button>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-[#25262b] rounded-sm text-sm transition-colors">
              <Wallet className="h-4 w-4" />
              View Wallet
            </button>
            <button
              onClick={copyAddress}
              className="flex items-center gap-2 px-4 py-2 hover:bg-[#25262b] rounded-sm text-sm transition-colors"
            >
              <Copy className="h-4 w-4" />
              Copy address
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 hover:bg-[#25262b] rounded-sm text-sm text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mb-8">
          <div className="text-center">
            <div className="text-2xl font-bold">{user.follower_count}</div>
            <div className="text-gray-400 text-sm">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{user.following_count}</div>
            <div className="text-gray-400 text-sm">Following</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">0</div>
            <div className="text-gray-400 text-sm">Created coins</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#25262b] mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('balances')}
              className={`pb-3 font-medium transition-colors ${
                activeTab === 'balances'
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Balances
            </button>
            <button
              onClick={() => setActiveTab('replies')}
              className={`pb-3 font-medium transition-colors ${
                activeTab === 'replies'
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Replies
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`pb-3 font-medium transition-colors ${
                activeTab === 'notifications'
                  ? 'text-white border-b-2 border-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Notifications
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'balances' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm text-gray-400 mb-2">
              <div>Coins</div>
              <div className="text-right">MCap</div>
              <div className="text-right">Value</div>
            </div>
            <div className="bg-[#181821] rounded-sm p-4">
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                       alt="SOL" className="w-8 h-8 rounded-full" />
                  <div>
                    <div className="font-medium">Solana balance</div>
                    <div className="text-sm text-gray-400">0.0000 SOL</div>
                  </div>
                </div>
                <div className="text-right"></div>
                <div className="text-right font-medium">$0</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'replies' && (
          <div className="text-center py-12 text-gray-400">
            No replies yet
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="text-center py-12 text-gray-400">
            No notifications
          </div>
        )}

        {/* Who to follow */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold mb-4">Who to follow</h3>
          <div className="space-y-3">
            {/* Sample follow suggestions */}
            <div className="bg-[#181821] rounded-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                <div>
                  <div className="font-medium">User Name</div>
                  <div className="text-sm text-gray-400">0 followers</div>
                </div>
              </div>
              <button className="px-4 py-1.5 bg-[#83EFAA] hover:bg-[#73df9a] text-black rounded-sm text-sm font-medium transition-colors">
                Follow
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#181821] rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">edit profile</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-[#25262b] rounded-sm transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <img
                  src={avatarUrl}
                  alt={user.display_name}
                  className="w-full h-full rounded-full border-2 border-[#25262b]"
                />
                <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full">
                  <Camera className="h-4 w-4 text-black" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-[#15161B] border border-[#2E3036] rounded-sm text-white focus:border-white/50 focus:outline-none transition-colors"
                  placeholder="Enter username"
                />
                <p className="text-xs text-gray-400 mt-1">
                  you can change your username once every day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#15161B] border border-[#2E3036] rounded-sm text-white focus:border-white/50 focus:outline-none transition-colors resize-none"
                  placeholder="describe your profile"
                  rows={3}
                />
              </div>
            </div>

            <button
              onClick={handleProfileUpdate}
              disabled={isUpdating || !username.trim()}
              className="w-full mt-6 px-4 py-2 bg-[#83EFAA] hover:bg-[#73df9a] disabled:opacity-50 text-black font-medium rounded-sm transition-colors"
            >
              {isUpdating ? 'Updating...' : 'save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}