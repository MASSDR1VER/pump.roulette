/**
 * Chat Monitor Page
 * Monitor and manage XMPP chat conversations grouped by listing
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  MessageSquare,
  Users,
  Send,
  Search,
  Package,
  User,
  Clock,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiClient } from '@/lib/api-client'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ChatMessage {
  id: string
  message: string
  timestamp: string
  direction: 'received' | 'sent'
  sender_user_id?: string
  listing_title?: string
  item_id?: string
}

interface ListingMessages {
  listing_id: string
  listing_title: string
  item_id: string
  account_id: string
  account_name: string
  message_count: number
  received_count: number
  sent_count: number
  unique_buyers: number
  last_message: string
  last_sender: string
  last_timestamp: string
}

interface BuyerConversation {
  buyer_id: string
  message_count: number
  messages: ChatMessage[]
}

export default function ChatPage() {
  const [selectedListing, setSelectedListing] = useState<string>()
  const [selectedAccount, setSelectedAccount] = useState<string>()
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  // Fetch messages grouped by listing
  const { data: listingsData, isLoading: listingsLoading, refetch: refetchListings } = useQuery({
    queryKey: ['messages-by-listing'],
    queryFn: () => apiClient.getMessagesByListing(0, 100),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Fetch messages for selected listing and account
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['listing-messages', selectedListing, selectedAccount],
    queryFn: () => selectedListing && selectedAccount ? 
      fetch(`http://localhost:8000/api/chat/messages/listing/${selectedListing}?account_id=${selectedAccount}`)
        .then(res => res.json()) : null,
    enabled: !!(selectedListing && selectedAccount),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  // Fetch chat monitor status
  const { data: statusData } = useQuery({
    queryKey: ['chat-status'],
    queryFn: () => apiClient.getChatStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch chat statistics
  const { data: statsData } = useQuery({
    queryKey: ['chat-statistics'],
    queryFn: async () => {
      const response = await fetch('http://localhost:8000/api/chat/statistics')
      if (!response.ok) throw new Error('Failed to fetch statistics')
      return response.json()
    },
    refetchInterval: 60000, // Refresh every minute
  })

  const listingGroups: ListingMessages[] = listingsData?.data || []
  const conversations: BuyerConversation[] = messagesData?.data || []
  const chatStatus = statusData?.data
  
  // Debug logging
  if (statsData?.data) {
    console.log('Chat Statistics:', statsData.data)
  }
  if (listingsData?.data) {
    console.log('Listings Data:', listingsData.data.length, 'listings')
  }

  const filteredListings = listingGroups.filter((listing) =>
    listing.listing_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    listing.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    listing.last_message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle selection
  const handleListingSelect = (listing: ListingMessages) => {
    setSelectedListing(listing.listing_id)
    setSelectedAccount(listing.account_id)
  }

  const selectedListingData = listingGroups.find(l => l.listing_id === selectedListing && l.account_id === selectedAccount)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Chat Messages</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              View and manage messages from buyers
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetchListings()}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {(chatStatus || statsData?.data) && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                <Badge variant={(chatStatus?.is_running || statsData?.data?.is_running) ? 'default' : 'secondary'} className="justify-center">
                  {(chatStatus?.is_running || statsData?.data?.is_running) ? 'Monitor Active' : 'Monitor Inactive'}
                </Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {(chatStatus?.is_running || statsData?.data?.is_running) && (
                    <span>
                      {statsData?.data?.connected_clients || chatStatus?.connected_clients || 0}/{statsData?.data?.total_clients || chatStatus?.total_clients || 0} connected
                    </span>
                  )}
                  <span>
                    {statsData?.data?.message_statistics?.total_messages || 0} msgs
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(listingGroups.map(l => l.account_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">Accounts with messages</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsData?.data?.message_statistics?.total_messages || listingGroups.reduce((acc, l) => acc + l.message_count, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {statsData?.data?.message_statistics?.received_messages || 0} received, {statsData?.data?.message_statistics?.sent_messages || 0} sent
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Buyers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {listingGroups.reduce((acc, l) => acc + l.unique_buyers, 0)}
              </div>
              <p className="text-xs text-muted-foreground">People interested</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto Reply Rate</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(statsData?.data?.message_statistics?.auto_reply_rate || 0)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {statsData?.data?.message_statistics?.recent_messages_24h || 0} messages (24h)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Active Listings */}
        {statsData?.data?.top_active_listings && statsData.data.top_active_listings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>Top Active Listings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statsData.data.top_active_listings.slice(0, 5).map((listing, index) => (
                  <div key={listing.item_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-sm">Item ID: {listing.item_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {listing.message_count} messages
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {listing.message_count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Interface */}
        <div className="grid gap-4 lg:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Listings with Messages */}
          <Card className="lg:col-span-1">
            <CardHeader className="space-y-3">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Listings</span>
                </CardTitle>
              </div>
              <div className="relative w-full">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[350px] sm:h-[400px] lg:h-[500px]">
                {listingsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading listings...
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {listingGroups.length === 0 ? (
                      <div>
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No messages received yet</p>
                        <p className="text-xs mt-1">Messages will appear here when buyers contact you</p>
                      </div>
                    ) : (
                      <div>
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No matches found</p>
                        <p className="text-xs mt-1">Try adjusting your search terms</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1 p-4">
                    {filteredListings.map((listing) => (
                      <div
                        key={`${listing.item_id}-${listing.account_id}`}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-accent transition-colors border ${
                          selectedListing === listing.listing_id && selectedAccount === listing.account_id ? 'bg-accent border-primary' : 'border-transparent'
                        }`}
                        onClick={() => handleListingSelect(listing)}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{listing.listing_title}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                  {listing.account_name}
                                </Badge>
                                <Badge variant="outline" className="text-xs px-2 py-0.5">
                                  ID: {listing.item_id.slice(-6)}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground truncate mt-2">
                                {listing.last_message}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                <span>{listing.unique_buyers} buyers</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-600">
                                <MessageSquare className="h-3 w-3" />
                                <span>{listing.received_count} received</span>
                              </div>
                              <div className="flex items-center gap-1 text-blue-600">
                                <Send className="h-3 w-3" />
                                <span>{listing.sent_count} sent</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(listing.last_timestamp), { 
                                addSuffix: true,
                                locale: tr 
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span className="truncate">
                    {selectedListingData 
                      ? selectedListingData.listing_title
                      : 'Select a listing'
                    }
                  </span>
                </CardTitle>
                {selectedListingData && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {selectedListingData.account_name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedListingData.item_id.slice(-6)}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedListing && selectedAccount ? (
                <div className="h-[350px] sm:h-[400px] lg:h-[500px]">
                  <ScrollArea className="h-full p-4">
                    {messagesLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Loading conversations...
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No conversations found</p>
                        <p className="text-xs mt-1">No messages yet for this listing and account</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {conversations.map((conversation) => (
                          <div key={conversation.buyer_id} className="border rounded-lg p-4 bg-card">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">Buyer {conversation.buyer_id}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {conversation.message_count} messages
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              {conversation.messages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex ${
                                    message.direction === 'sent' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                                      message.direction === 'sent'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted border'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-medium">
                                        {message.direction === 'sent' ? 'Auto Reply' : 'Buyer'}
                                      </span>
                                      {message.direction === 'sent' && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                                          Auto
                                        </Badge>
                                      )}
                                      <span className="text-xs opacity-70 ml-auto">
                                        {formatDistanceToNow(new Date(message.timestamp), { 
                                          addSuffix: true,
                                          locale: tr 
                                        })}
                                      </span>
                                    </div>
                                    <div className="leading-relaxed">{message.message}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] sm:h-[400px] lg:h-[500px] text-muted-foreground p-4">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center text-sm sm:text-base">Select a listing to view messages</p>
                  <p className="text-center text-xs mt-2 opacity-70">Choose a listing from the left panel to see the conversation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}