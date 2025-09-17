import { useState, useCallback, useEffect } from 'react'

export interface User {
  wallet_address: string
  username?: string
  display_name: string
  profile_image: string
  bio?: string
  is_verified: boolean
  is_premium: boolean
  reputation_score: number
  total_calls_made: number
  total_calls_joined: number
  created_at: string
  follower_count: number
  following_count: number
}

interface WalletProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string }
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

declare global {
  interface Window {
    solana?: WalletProvider
    phantom?: {
      solana?: WalletProvider
    }
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Compute isWalletConnected based on user state
  // A wallet is connected if user exists, has wallet_address, and it's not a guest wallet
  const isWalletConnected = !!(user && user.wallet_address && !user.wallet_address.startsWith('guest_'))

  // Check for existing session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token')
      if (token) {
        validateToken(token)
      }
    }
  }, [])

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('https://app.pump-roulette.com/api/v1/auth/wallet/validate', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Get full user profile
          await getUserProfile(token)
        } else {
          if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token')
        }
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token')
        }
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      localStorage.removeItem('auth_token')
    }
  }

  const getUserProfile = async (token: string) => {
    try {
      const response = await fetch('https://app.pump-roulette.com/api/v1/auth/wallet/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setUser(data.user)
        }
      }
    } catch (error) {
      console.error('Failed to get user profile:', error)
    }
  }

  const getWalletProvider = (): WalletProvider | null => {
    if (typeof window === 'undefined') return null

    // Try Phantom first
    if (window.phantom?.solana?.isPhantom) {
      return window.phantom.solana
    }

    // Fallback to window.solana
    if (window.solana?.isPhantom) {
      return window.solana
    }

    return null
  }

  const connectWallet = useCallback(async () => {
    console.log('Connect wallet button clicked')
    setIsConnecting(true)
    setError(null)

    try {
      const provider = getWalletProvider()
      console.log('Wallet provider:', provider)

      if (!provider) {
        console.log('No wallet provider found')
        setError('wallet_not_found')
        setIsConnecting(false)
        return
      }

      console.log('Attempting to connect to Phantom wallet...')

      // Connect to wallet
      const response = await provider.connect()
      const walletAddress = response.publicKey.toString()
      console.log('Wallet connected:', walletAddress)

      // Step 1: Get authentication message
      const connectResponse = await fetch('https://app.pump-roulette.com/api/v1/auth/wallet/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_address: walletAddress
        })
      })

      if (!connectResponse.ok) {
        throw new Error('Failed to get authentication message')
      }

      const { auth_message } = await connectResponse.json()
      console.log('Got auth message:', auth_message)

      // Step 2: Sign the message
      const message = new TextEncoder().encode(auth_message)
      const signResult = await provider.signMessage(message)
      console.log('Message signed successfully')

      // Step 3: Verify signature and get token
      const verifyResponse = await fetch('https://app.pump-roulette.com/api/v1/auth/wallet/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          message: auth_message,
          signature: btoa(String.fromCharCode(...signResult.signature)),
          username: null // Can be set later
        })
      })

      if (!verifyResponse.ok) {
        throw new Error('Wallet signature verification failed')
      }

      const verifyData = await verifyResponse.json()
      console.log('Verification response:', verifyData)

      if (verifyData.success) {
        // Store token and user data
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', verifyData.token)
        }
        setUser(verifyData.user)
        console.log('Wallet authenticated successfully')
      } else {
        throw new Error('Authentication failed')
      }

    } catch (error: any) {
      console.error('Wallet connection failed:', error)
      setError(error.message || 'Failed to connect wallet')
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const loginAsGuest = useCallback(() => {
    // Create a guest user (no wallet connection, limited features)
    const guestUser = {
      wallet_address: `guest_${Date.now()}`,
      username: `Guest${Math.floor(Math.random() * 10000)}`,
      display_name: `Guest${Math.floor(Math.random() * 10000)}`,
      profile_image: 'https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1?img-width=93&img-dpr=2&img-onerror=redirect',
      is_verified: false,
      is_premium: false,
      reputation_score: 0,
      total_calls_made: 0,
      total_calls_joined: 0,
      created_at: new Date().toISOString(),
      follower_count: 0,
      following_count: 0
    }
    setUser(guestUser)
    if (typeof window !== 'undefined') {
      localStorage.setItem('guest_user', JSON.stringify(guestUser))
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const provider = getWalletProvider()
      if (provider && provider.disconnect) {
        await provider.disconnect()
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('guest_user')
    }
    setUser(null)
    setError(null)
  }, [])

  return {
    user,
    isConnecting,
    error,
    connectWallet,
    loginAsGuest,
    logout,
    isAuthenticated: !!user,
    isWalletConnected  // Use the computed value from above
  }
}