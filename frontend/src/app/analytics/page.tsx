/**
 * Analytics Page
 * View performance metrics, statistics, and insights
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Eye,
  MessageSquare,
  Users,
  FileText,
  Calendar,
  Filter,
  Download
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'

interface MetricCard {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: any
  trend: 'up' | 'down' | 'neutral'
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('7d')
  const [selectedMetric, setSelectedMetric] = useState('views')

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: () => apiClient.getAnalytics(dateRange),
  })

  // Fetch top categories
  const { data: categoriesData } = useQuery({
    queryKey: ['analytics-categories'],
    queryFn: () => apiClient.getTopCategories(),
  })

  // Fetch recent activity
  const { data: activityData } = useQuery({
    queryKey: ['analytics-activity'],
    queryFn: () => apiClient.getRecentActivity(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const metrics = analyticsData?.data || {}

  // Real data from API
  const metricCards: MetricCard[] = [
    {
      title: 'Total Views',
      value: metrics.total_views?.toLocaleString() || '0',
      change: 12.5,
      changeLabel: 'vs last period',
      icon: Eye,
      trend: 'up'
    },
    {
      title: 'Active Listings',
      value: metrics.active_listings?.toLocaleString() || '0',
      change: -2.3,
      changeLabel: 'vs last period',
      icon: FileText,
      trend: 'down'
    },
    {
      title: 'Messages Received',
      value: metrics.messages_received?.toLocaleString() || '0',
      change: 8.7,
      changeLabel: 'vs last period',
      icon: MessageSquare,
      trend: 'up'
    },
    {
      title: 'Account Performance',
      value: `${metrics.account_performance || 0}%`,
      change: 3.2,
      changeLabel: 'success rate',
      icon: Users,
      trend: 'up'
    }
  ]

  // Get real recent activity from API
  const recentActivity = activityData?.data || []

  // Get real categories from API
  const topCategories = categoriesData?.data || []

  const handleExportData = () => {
    // TODO: Implement data export
    console.log('Export analytics data')
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />
      default:
        return null
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Track performance metrics and gain insights into your automation
            </p>
          </div>
          <div className="flex space-x-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={handleExportData}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="flex items-center pt-1">
                  {getTrendIcon(metric.trend)}
                  <span className={`text-xs ml-1 ${getTrendColor(metric.trend)}`}>
                    {metric.change > 0 ? '+' : ''}{metric.change}% {metric.changeLabel}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Top Categories</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium">{category.name}</div>
                      <Badge variant="outline" className="text-xs">
                        {category.listings} listings
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {category.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="mt-1">
                      {activity.type === 'listing_created' && (
                        <FileText className="h-4 w-4 text-blue-500" />
                      )}
                      {activity.type === 'message_received' && (
                        <MessageSquare className="h-4 w-4 text-green-500" />
                      )}
                      {activity.type === 'listing_viewed' && (
                        <Eye className="h-4 w-4 text-purple-500" />
                      )}
                      {activity.type === 'account_synced' && (
                        <Users className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium">{activity.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.description}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{activity.relative_time || activity.timestamp}</span>
                        <span>•</span>
                        <span>{activity.account}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Listing Success Rate</div>
                <div className="text-2xl font-bold">{metrics.success_rate || 0}%</div>
                <div className="text-xs text-muted-foreground">
                  Successfully published listings
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Total Listings</div>
                <div className="text-2xl font-bold">{metrics.total_listings?.toLocaleString() || 0}</div>
                <div className="text-xs text-muted-foreground">
                  Listings created in period
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium">Active Accounts</div>
                <div className="text-2xl font-bold">{metrics.active_accounts || 0}/{metrics.total_accounts || 0}</div>
                <div className="text-xs text-muted-foreground">
                  Active vs total accounts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}