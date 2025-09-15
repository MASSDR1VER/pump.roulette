/**
 * System Management Page
 * Monitor system health, logs, and configuration
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Server,
  Database,
  Wifi,
  HardDrive,
  Cpu,
  MemoryStick,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
  Download,
  Trash2,
  Eye,
  Search
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'

interface SystemMetric {
  name: string
  value: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  icon: any
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source: string
}

export default function SystemPage() {
  const [logLevel, setLogLevel] = useState('all')
  const [logSearch, setLogSearch] = useState('')
  const [selectedService, setSelectedService] = useState('all')
  const queryClient = useQueryClient()

  // Fetch system health
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiClient.getSystemHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch system logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['system-logs', logLevel, selectedService],
    queryFn: () => apiClient.getSystemLogs({ level: logLevel, service: selectedService }),
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const health = healthData?.data || {}
  const logs: LogEntry[] = logsData?.data || []

  // Helper function to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // System metrics from real API data
  const systemMetrics: SystemMetric[] = [
    {
      name: 'CPU Usage',
      value: health.resources?.cpu_usage || 0,
      unit: '%',
      status: health.resources?.cpu_usage > 80 ? 'critical' : health.resources?.cpu_usage > 60 ? 'warning' : 'healthy',
      icon: Cpu
    },
    {
      name: 'Memory Usage',
      value: health.resources?.memory_usage || 0,
      unit: '%',
      status: health.resources?.memory_usage > 80 ? 'critical' : health.resources?.memory_usage > 60 ? 'warning' : 'healthy',
      icon: MemoryStick
    },
    {
      name: 'Disk Usage',
      value: health.resources?.disk_usage || 0,
      unit: '%',
      status: health.resources?.disk_usage > 80 ? 'critical' : health.resources?.disk_usage > 60 ? 'warning' : 'healthy',
      icon: HardDrive
    },
    {
      name: 'Network I/O',
      value: health.network ? Math.round((health.network.bytes_sent + health.network.bytes_recv) / (1024 * 1024 * 1024)) : 0,
      unit: 'GB',
      status: 'healthy',
      icon: Wifi
    }
  ]

  const services = [
    {
      name: 'FastAPI Backend',
      status: health.status === 'healthy' ? 'running' : 'stopped',
      uptime: health.timestamp ? new Date(health.timestamp).toLocaleString() : '-',
      version: '2.0.0',
      port: 8000
    },
    {
      name: 'MongoDB Database',
      status: health.services?.database === 'connected' ? 'running' : 'stopped',
      uptime: '-',
      version: '6.0.2',
      port: 27017
    },
    {
      name: 'Task Manager',
      status: health.services?.task_manager || 'stopped',
      uptime: '-',
      version: '1.0.0',
      port: '-'
    },
    {
      name: 'Chat Monitor',
      status: 'running',
      uptime: '-',
      version: '1.0.0',
      port: '-'
    }
  ]

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
                         log.source.toLowerCase().includes(logSearch.toLowerCase())
    const matchesLevel = logLevel === 'all' || log.level === logLevel
    return matchesSearch && matchesLevel
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'stopped':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default' as const
      case 'stopped':
        return 'destructive' as const
      default:
        return 'outline' as const
    }
  }

  const getMetricColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-muted-foreground'
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600'
      case 'warning':
        return 'text-yellow-600'
      case 'info':
        return 'text-blue-600'
      case 'debug':
        return 'text-gray-600'
      default:
        return 'text-muted-foreground'
    }
  }

  const handleClearLogs = () => {
    // TODO: Implement clear logs
    console.log('Clear system logs')
  }

  const handleDownloadLogs = () => {
    // TODO: Implement download logs
    console.log('Download system logs')
  }

  const handleRestartService = async (serviceName: string) => {
    try {
      // For Task Manager, we have specific start/stop endpoints
      if (serviceName === 'Task Manager') {
        const taskManagerStatus = health.services?.task_manager || 'stopped'
        
        if (taskManagerStatus === 'stopped') {
          // Start the task manager
          await apiClient.startTaskManager(3)
        } else {
          // Stop and restart the task manager
          await apiClient.stopTaskManager()
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
          await apiClient.startTaskManager(3)
        }
        
        // Refetch health data to update UI
        await queryClient.invalidateQueries({ queryKey: ['system-health'] })
      } else {
        // For other services, use the restart endpoint
        await apiClient.restartService(serviceName)
        
        // Refetch health data to update UI
        await queryClient.invalidateQueries({ queryKey: ['system-health'] })
      }
    } catch (error) {
      console.error(`Failed to restart ${serviceName}:`, error)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System</h1>
            <p className="text-muted-foreground">
              Monitor system health, logs, and service status
            </p>
            {health.system && (
              <p className="text-sm text-muted-foreground mt-1">
                {health.system.platform} • Python {health.system.python_version} • {health.system.architecture}
              </p>
            )}
          </div>
          <Button className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>System Settings</span>
          </Button>
        </div>

        {/* System Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {systemMetrics.map((metric, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metric.unit === '%' ? metric.value.toFixed(1) : metric.value}{metric.unit}
                </div>
                <Progress value={metric.value} className="mt-2" />
                <div className={`text-xs mt-1 ${getMetricColor(metric.status)}`}>
                  {metric.status}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Services Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>Services Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          v{service.version} • Uptime: {service.uptime}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusVariant(service.status)}>
                        {service.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestartService(service.name)}
                        disabled={service.name === 'MongoDB Database' || service.name === 'Chat Monitor' || service.name === 'FastAPI Backend'}
                        title={service.name === 'Task Manager' ? 'Start/Restart Task Manager' : 'Restart service not available'}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Database Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Connection Status</div>
                    <div className="flex items-center space-x-2 mt-1">
                      {health.services?.database === 'connected' ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Connected</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm">Disconnected</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">System Memory</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {health.resources?.memory_used && health.resources?.memory_total ? 
                        `${formatBytes(health.resources.memory_used)} / ${formatBytes(health.resources.memory_total)}` : '-'}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="text-sm font-medium">Collections ({Object.values(health.collections || {}).reduce((sum: number, val: any) => sum + (val || 0), 0)} total documents)</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Accounts: {health.collections?.accounts || 0}</div>
                    <div>Listings: {health.collections?.listings || 0}</div>
                    <div>Tasks: {health.collections?.tasks || 0}</div>
                    <div>Categories: {health.collections?.categories || 0}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Eye className="h-5 w-5" />
                <span>System Logs</span>
              </CardTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearLogs}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No logs found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Timestamp</TableHead>
                      <TableHead className="w-20">Level</TableHead>
                      <TableHead className="w-32">Source</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getLogLevelColor(log.level)}`}
                          >
                            {log.level.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.source}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}