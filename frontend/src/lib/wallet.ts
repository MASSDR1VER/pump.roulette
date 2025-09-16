/**
 * Wallet Helper Functions
 *
 * Provides utilities for Solana wallet connection and message signing
 */

import { PublicKey } from '@solana/web3.js'

// Type definitions for Phantom wallet
interface PhantomProvider {
  isPhantom?: boolean
  publicKey?: PublicKey
  isConnected?: boolean
  signMessage?: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

export interface WalletConnection {
  provider: PhantomProvider
  pubkey: string
}

/**
 * Connect to Phantom wallet
 * @returns Wallet connection with provider and public key
 */
export async function connectPhantom(): Promise<WalletConnection> {
  const provider = window?.solana

  if (!provider || !provider.isPhantom) {
    throw new Error('Phantom wallet not found. Please install Phantom.')
  }

  try {
    const response = await provider.connect({ onlyIfTrusted: false })
    return {
      provider,
      pubkey: response.publicKey.toString()
    }
  } catch (error) {
    console.error('Wallet connection error:', error)
    throw new Error('Failed to connect wallet')
  }
}

/**
 * Sign a message with the connected wallet
 * @param provider - Phantom provider instance
 * @param message - Message to sign
 * @returns Base64 encoded signature
 */
export async function signMessage(
  provider: PhantomProvider,
  message: string
): Promise<string> {
  if (!provider.signMessage) {
    throw new Error('Wallet does not support message signing')
  }

  try {
    const encoded = new TextEncoder().encode(message)
    const { signature } = await provider.signMessage(encoded, 'utf8')

    // Convert Uint8Array to base64
    return Buffer.from(signature).toString('base64')
  } catch (error) {
    console.error('Message signing error:', error)
    throw new Error('Failed to sign message')
  }
}

/**
 * Disconnect from wallet
 * @param provider - Phantom provider instance
 */
export async function disconnectWallet(provider: PhantomProvider): Promise<void> {
  if (provider && provider.disconnect) {
    await provider.disconnect()
  }
}

/**
 * Check if Phantom wallet is installed
 * @returns Boolean indicating if Phantom is available
 */
export function isPhantomInstalled(): boolean {
  return Boolean(window?.solana?.isPhantom)
}

/**
 * Check if wallet is connected
 * @returns Boolean indicating connection status
 */
export function isWalletConnected(): boolean {
  const provider = window?.solana
  return Boolean(provider?.isConnected && provider?.publicKey)
}

/**
 * Get connected wallet address
 * @returns Wallet address or null if not connected
 */
export function getConnectedWallet(): string | null {
  const provider = window?.solana
  if (provider?.isConnected && provider?.publicKey) {
    return provider.publicKey.toString()
  }
  return null
}

/**
 * Format wallet address for display
 * @param address - Full wallet address
 * @returns Shortened address (e.g., "AbCd...XyZ")
 */
export function formatWalletAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}