'use client'

import { X, ExternalLink } from 'lucide-react'

interface WalletConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onPhantomClick: () => void
  isConnecting: boolean
}

export function WalletConnectionModal({ isOpen, onClose, onPhantomClick, isConnecting }: WalletConnectionModalProps) {
  if (!isOpen) return null

  const handlePhantomInstall = () => {
    window.open('https://phantom.app/', '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b23] border border-[#25262b] rounded-2xl max-w-sm w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-[#7DE2A1] to-[#55d292] rounded-xl flex items-center justify-center mx-auto mb-3 transform rotate-12">
            <div className="w-6 h-6 bg-white rounded-md transform -rotate-12"></div>
          </div>
          <h2 className="text-lg font-bold text-white">connect wallet</h2>
        </div>

        {/* Phantom wallet option */}
        <button
          onClick={onPhantomClick}
          disabled={isConnecting}
          className="w-full p-4 bg-[#25262b] hover:bg-[#2a2b30] disabled:opacity-50 rounded-xl border border-[#35363b] transition-colors mb-4 flex items-center gap-3"
        >
          {/* Official Phantom logo */}
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <svg width="32" height="32" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_2596_138572)">
                <rect y="0.00100708" width="1200" height="1200" fill="#AB9FF2"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M522.218 764.815C475.101 837.013 396.147 928.38 291.089 928.38C241.425 928.38 193.671 907.934 193.671 819.124C193.671 592.944 502.479 242.814 789.003 242.814C952.003 242.814 1016.95 355.904 1016.95 484.327C1016.95 649.17 909.979 837.652 803.647 837.652C769.901 837.652 753.346 819.124 753.346 789.733C753.346 782.066 754.62 773.76 757.167 764.815C720.874 826.791 650.835 884.294 585.253 884.294C537.499 884.294 513.304 854.264 513.304 812.095C513.304 796.761 516.487 780.788 522.218 764.815ZM769.035 479.869C769.035 517.291 746.956 536.002 722.258 536.002C697.185 536.002 675.481 517.291 675.481 479.869C675.481 442.448 697.185 423.737 722.258 423.737C746.956 423.737 769.035 442.448 769.035 479.869ZM909.367 479.87C909.367 517.291 887.288 536.002 862.59 536.002C837.517 536.002 815.813 517.291 815.813 479.87C815.813 442.448 837.517 423.737 862.59 423.737C887.288 423.737 909.367 442.448 909.367 479.87Z" fill="#FFFDF8"/>
              </g>
              <defs>
                <clipPath id="clip0_2596_138572">
                  <rect y="0.00100708" width="1200" height="1200" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>
          <span className="text-white font-medium">
            {isConnecting ? 'Connecting...' : 'Phantom'}
          </span>
        </button>

        {/* Install Phantom message */}
        <div className="bg-[#25262b] border border-[#35363b] rounded-xl p-4">
          <div className="text-center">
            <div className="text-white font-medium mb-2">Don't have Phantom?</div>
            <div className="text-sm text-gray-400 mb-3">
              Install the Phantom wallet to connect your Solana wallet.
            </div>
            <button
              onClick={handlePhantomInstall}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7DE2A1] hover:bg-[#6dd291] text-black rounded-lg text-sm font-medium transition-colors"
            >
              <span>Install Phantom</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}