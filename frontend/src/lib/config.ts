/**
 * Application configuration
 * Gets configuration from environment variables with fallbacks
 */

export const config = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
  },
  websocket: {
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',
  },
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Letgo Automation',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
  },
} as const

export type Config = typeof config