/**
 * API Client for Letgo Automation Backend
 * Handles all HTTP requests to the backend API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { config } from './config'

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  total?: number
  page?: number
  limit?: number
}

export interface ApiError {
  success: false
  error: string
  message: string
  details?: Record<string, any>
}

// Account Types
export type AccountType = 'letgo_cookies'

export interface Account {
  id: string
  account_type: AccountType
  email: string
  name?: string
  display_name?: string
  status: 'active' | 'inactive' | 'suspended' | 'pending' | 'banned' | 'error' | 'cookie_error'
  cookies: any[]
  assigned_proxy?: {
    ip: string
    port: number
    username?: string
    password?: string
  }
  total_listings: number
  active_listings: number
  published_listings: number
  successful_listings?: number
  failed_listings?: number
  created_at: string
  updated_at: string
}

// Listing Types
export interface Listing {
  id: string
  _id?: string  // MongoDB ID
  account_id: string
  title: string
  description: string
  price: number
  category: string
  subcategory?: string
  city: string
  district: string
  image_urls?: string[]  // Backend uses image_urls
  images?: string[]  // For compatibility
  status: 'draft' | 'published' | 'expired' | 'sold' | 'inactive' | 'active' | 'failed'
  letgo_listing_id?: string
  letgo_id?: string  // For compatibility
  letgo_url?: string
  technical_specs?: Record<string, any>
  view_count?: number
  views?: number  // For compatibility
  created_at: string
  updated_at: string
  published_at?: string
}

// Category Types
export interface Category {
  id: number
  name: string
  name_tr: string
  parent?: number
  image?: string
  isLastChild?: boolean
  subcategories?: Category[]
  attributes?: any[]
}

// Task Types
export interface Task {
  id: string
  task_type: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  progress: number
  data?: Record<string, any>
  result?: Record<string, any>
  error?: string
  description?: string
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

// Task Manager Status
export interface TaskManagerStatus {
  is_running: boolean
  workers_count: number
  queue_size: number
  processed_tasks: number
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        const errorMessage = error.response?.data?.detail || 
                           error.response?.data?.message || 
                           error.response?.statusText || 
                           error.message || 
                           'Unknown error occurred'
        
        const errorObj = {
          message: errorMessage,
          status: error.response?.status,
          data: error.response?.data
        }
        
        console.error('API Error:', errorObj)
        return Promise.reject(new Error(errorMessage))
      }
    )
  }

  // Health Check
  async health(): Promise<ApiResponse> {
    const response = await this.client.get('/health')
    return response.data
  }

  // Accounts API
  async getAccounts(page = 1, limit = 100000): Promise<ApiResponse<Account[]>> {
    const response = await this.client.get('/api/accounts', {
      params: { page, limit }
    })
    return response.data
  }

  async getAccount(id: string): Promise<ApiResponse<Account>> {
    const response = await this.client.get(`/api/accounts/${id}`)
    return response.data
  }

  async createAccount(data: Partial<Account>): Promise<ApiResponse<Account>> {
    const response = await this.client.post('/api/accounts', data)
    return response.data
  }

  async updateAccount(id: string, data: Partial<Account>): Promise<ApiResponse<Account>> {
    const response = await this.client.put(`/api/accounts/${id}`, data)
    return response.data
  }

  async deleteAccount(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/api/accounts/${id}`)
    return response.data
  }

  // Listings API
  async getListings(page = 1, limit = 100000): Promise<ApiResponse<Listing[]>> {
    const response = await this.client.get('/api/listings', {
      params: { page, limit }
    })
    return response.data
  }

  async getListing(id: string): Promise<ApiResponse<Listing>> {
    const response = await this.client.get(`/api/listings/${id}`)
    return response.data
  }

  async createListing(data: Partial<Listing>): Promise<ApiResponse<Listing>> {
    const response = await this.client.post('/api/listings', data)
    return response.data
  }

  async updateListing(id: string, data: Partial<Listing>): Promise<ApiResponse<Listing>> {
    const response = await this.client.put(`/api/listings/${id}`, data)
    return response.data
  }

  async deleteListing(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/api/listings/${id}`)
    return response.data
  }

  async publishListing(id: string): Promise<ApiResponse> {
    const response = await this.client.post(`/api/listings/${id}/publish`)
    return response.data
  }

  // Categories API
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const response = await this.client.get('/api/categories')
    return response.data
  }

  async getCategoryTree(): Promise<ApiResponse<Category[]>> {
    const response = await this.client.get('/api/categories/tree')
    return response.data
  }

  async getCategoryAttributes(id: number): Promise<ApiResponse> {
    const response = await this.client.get(`/api/categories/${id}/attributes`)
    return response.data
  }

  async generateListingPayload(data: any): Promise<ApiResponse> {
    const response = await this.client.post('/api/categories/generate-payload', data)
    return response.data
  }

  // Tasks API
  async getTasks(): Promise<ApiResponse<Task[]>> {
    const response = await this.client.get('/api/tasks/')
    return response.data
  }

  async getTask(id: string): Promise<ApiResponse<Task>> {
    const response = await this.client.get(`/api/tasks/${id}`)
    return response.data
  }

  async createTask(data: Partial<Task>): Promise<ApiResponse<Task>> {
    const response = await this.client.post('/api/tasks/', data)
    return response.data
  }

  async cancelTask(id: string): Promise<ApiResponse> {
    const response = await this.client.put(`/api/tasks/${id}/cancel`)
    return response.data
  }

  async deleteTask(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/api/tasks/${id}`)
    return response.data
  }

  async deleteAllTasks(): Promise<ApiResponse> {
    const response = await this.client.delete('/api/tasks/all')
    return response.data
  }

  // Task Manager Control
  async startTaskManager(workers = 3): Promise<ApiResponse> {
    const response = await this.client.post(`/api/tasks/manager/start?workers=${workers}`)
    return response.data
  }

  async stopTaskManager(): Promise<ApiResponse> {
    const response = await this.client.post('/api/tasks/manager/stop')
    return response.data
  }

  async getTaskManagerStatus(): Promise<ApiResponse<TaskManagerStatus>> {
    try {
      const response = await this.client.get('/api/tasks/manager/status')
      return response.data
    } catch (error) {
      // Return default status if endpoint not available
      return {
        success: false,
        message: 'Task manager status unavailable',
        data: {
          is_running: false,
          workers_count: 0,
          queue_size: 0,
          processed_tasks: 0
        }
      }
    }
  }

  // Chat API
  async getChatConnections(): Promise<ApiResponse> {
    const response = await this.client.get('/api/chat/connections')
    return response.data
  }

  async getChatMessages(connectionId: string): Promise<ApiResponse> {
    const response = await this.client.get(`/api/chat/messages/${connectionId}`)
    return response.data
  }
  async getMessagesByListing(skip = 0, limit = 50): Promise<ApiResponse> {
    const response = await this.client.get(`/api/chat/messages/by-listing?skip=${skip}&limit=${limit}`)
    return response.data
  }
  async getListingMessages(listingId: string, skip = 0, limit = 50): Promise<ApiResponse> {
    const response = await this.client.get(`/api/chat/messages/listing/${listingId}?skip=${skip}&limit=${limit}`)
    return response.data
  }
  async getChatStatus(): Promise<ApiResponse> {
    const response = await this.client.get('/api/chat/status')
    return response.data
  }

  async sendChatMessage(connectionId: string, message: string): Promise<ApiResponse> {
    const response = await this.client.post(`/api/chat/messages/${connectionId}`, { message })
    return response.data
  }

  async startChatMonitor(): Promise<ApiResponse> {
    const response = await this.client.post('/api/chat/start')
    return response.data
  }

  async stopChatMonitor(): Promise<ApiResponse> {
    const response = await this.client.post('/api/chat/stop')
    return response.data
  }

  // Analytics API
  async getAnalytics(dateRange: string): Promise<ApiResponse> {
    const response = await this.client.get('/api/analytics', {
      params: { range: dateRange }
    })
    return response.data
  }

  async getWeeklyActivity(): Promise<ApiResponse> {
    const response = await this.client.get('/api/analytics/activity/weekly')
    return response.data
  }

  async getDailyPerformance(days = 30): Promise<ApiResponse> {
    const response = await this.client.get('/api/analytics/performance/daily', {
      params: { days }
    })
    return response.data
  }

  async getTopCategories(limit = 10): Promise<ApiResponse> {
    const response = await this.client.get('/api/analytics/top-categories', {
      params: { limit }
    })
    return response.data
  }

  async getRecentActivity(limit = 100000): Promise<ApiResponse> {
    const response = await this.client.get('/api/analytics/recent-activity', {
      params: { limit }
    })
    return response.data
  }

  // System Monitoring API
  async getSystemHealth(): Promise<ApiResponse> {
    const response = await this.client.get('/api/system/health')
    return response.data
  }

  async getSystemLogs(params: { level?: string; service?: string } = {}): Promise<ApiResponse> {
    const response = await this.client.get('/api/system/logs', { params })
    return response.data
  }

  async clearSystemLogs(): Promise<ApiResponse> {
    const response = await this.client.delete('/api/system/logs')
    return response.data
  }

  async downloadSystemLogs(): Promise<ApiResponse> {
    const response = await this.client.get('/api/system/logs/download')
    return response.data
  }

  async restartService(serviceName: string): Promise<ApiResponse> {
    const response = await this.client.post(`/api/system/services/${serviceName}/restart`)
    return response.data
  }

  // Generic POST method
  async post(url: string, data?: any): Promise<ApiResponse> {
    const response = await this.client.post(url, data)
    return response.data
  }
  
  // Settings API
  async getSettings(): Promise<ApiResponse> {
    const response = await this.client.get('/api/settings')
    return response.data
  }

  async updateSettings(settings: Record<string, any>): Promise<ApiResponse> {
    const response = await this.client.put('/api/settings', settings)
    return response.data
  }

  async getSetting(key: string): Promise<ApiResponse> {
    const response = await this.client.get(`/api/settings/${key}`)
    return response.data
  }

  async updateSetting(key: string, value: any): Promise<ApiResponse> {
    const response = await this.client.put(`/api/settings/${key}`, { value })
    return response.data
  }

  // Proxy Management API
  async getProxies(): Promise<ApiResponse> {
    const response = await this.client.get('/api/proxies')
    return response.data
  }

  async createProxy(proxy: any): Promise<ApiResponse> {
    const response = await this.client.post('/api/proxies', proxy)
    return response.data
  }

  async updateProxy(id: string, proxy: any): Promise<ApiResponse> {
    const response = await this.client.put(`/api/proxies/${id}`, proxy)
    return response.data
  }

  async deleteProxy(id: string): Promise<ApiResponse> {
    const response = await this.client.delete(`/api/proxies/${id}`)
    return response.data
  }

  async testProxy(id: string): Promise<ApiResponse> {
    const response = await this.client.post(`/api/proxies/${id}/test`)
    return response.data
  }

  async bulkCreateProxies(proxiesText: string): Promise<ApiResponse> {
    const response = await this.client.post('/api/proxies/bulk', { proxies_text: proxiesText })
    return response.data
  }

  async assignProxiesToAccounts(): Promise<ApiResponse> {
    const response = await this.client.post('/api/proxies/assign-to-accounts')
    return response.data
  }

  // Admin Dashboard
  async getDashboardStats(): Promise<ApiResponse> {
    const response = await this.client.get('/api/admin/dashboard')
    return response.data
  }

  async getSystemStatus(): Promise<ApiResponse> {
    const response = await this.client.get('/api/admin/system/status')
    return response.data
  }

}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient