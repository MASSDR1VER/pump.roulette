/**
 * Application configuration
 * Gets configuration from environment variables with fallbacks
 */

export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://app.pump-roulette.com',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
  },
  websocket: {
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://app.pump-roulette.com/api/v1/chat/ws',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Pump Roulette',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
  },
} as const

export type Config = typeof config