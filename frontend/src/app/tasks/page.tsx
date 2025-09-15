/**
 * Tasks Management Page
 * Monitor and manage background tasks and operations
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Square,
  Pause,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient, Task } from '@/lib/api-client'
import toast from 'react-hot-toast'

const statusIcons = {
  pending: Clock,
  running: Play,
  completed: CheckCircle,
  failed: XCircle,
  paused: Pause,
  cancelled: XCircle,
}

const statusColors = {
  pending: 'text-yellow-500',
  running: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  paused: 'text-gray-500',
  cancelled: 'text-red-500',
}

const statusVariants = {
  pending: 'outline' as const,
  running: 'default' as const,
  completed: 'default' as const,
  failed: 'destructive' as const,
  paused: 'secondary' as const,
  cancelled: 'destructive' as const,
}

const taskTypeLabels = {
  publish_listing_all_accounts: 'Publish to All Accounts',
  accounts_check: 'Check All Accounts',
  proxy_check: 'Check All Proxies',
  chat_monitoring: 'Chat Monitoring',
  listing_check: 'Listing Monitor',
  change_account_names: 'Change Account Names',
  delete_all_listings: 'Delete All Listings',
}

const taskTypeDescriptions = {
  publish_listing_all_accounts: 'Publishes the given listing from all active accounts in the system. This task can be completed.',
  accounts_check: 'Checks authentication status of all accounts and automatically deletes invalid accounts. This task can be completed.',
  proxy_check: 'Checks whether all proxies are working. This task can be completed.',
  chat_monitoring: 'Monitors incoming messages and sends automatic responses. This task runs continuously and never completes.',
  listing_check: 'Checks listings and reopens closed listings. This task runs continuously and never completes.',
  change_account_names: 'Changes the display names of all accounts to the specified name. This task can be completed.',
  delete_all_listings: 'Deletes all active listings from all accounts in the system. This task can be completed.',
}

export default function TasksPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [taskToCancel, setTaskToCancel] = useState<Task | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [excludedCities, setExcludedCities] = useState<string[]>([])
  const [formData, setFormData] = useState({
    task_type: '',
    data: {},
    priority: 'medium',
    description: '',
    name: ''
  })
  
  const queryClient = useQueryClient()

  // Fetch tasks
  const { data: tasksData, isLoading, refetch } = useQuery({
    queryKey: ['tasks', currentPage, searchTerm],
    queryFn: () => apiClient.getTasks(),
    refetchInterval: 5000, // Refresh every 5 seconds
  })

  // Fetch task manager status
  const { data: taskManagerStatus } = useQuery({
    queryKey: ['task-manager-status'],
    queryFn: () => apiClient.getTaskManagerStatus(),
    refetchInterval: 5000,
  })

  // Fetch listing templates for publish task
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['listing-templates'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/listings/templates`)
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }
      return response.json()
    },
    enabled: showCreateModal && formData.task_type === 'publish_listing_all_accounts'
  })

  // Fetch accounts to check if any exist
  const { data: accountsData } = useQuery({
    queryKey: ['accounts-check'],
    queryFn: () => apiClient.getAccounts(),
    enabled: showCreateModal
  })

  // Fetch listings to check if any exist
  const { data: listingsData } = useQuery({
    queryKey: ['listings-check'],
    queryFn: () => apiClient.getListings(),
    enabled: showCreateModal && (formData.task_type === 'chat_monitoring' || formData.task_type === 'listing_check')
  })

  // Fetch Turkish cities for exclusion
  const { data: citiesData } = useQuery({
    queryKey: ['turkish-cities'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/system/turkish-cities`)
      if (!response.ok) {
        throw new Error('Failed to fetch cities')
      }
      return response.json()
    },
    enabled: showCreateModal && formData.task_type === 'publish_listing_all_accounts'
  })

  const tasks = tasksData?.data || []
  const isTaskManagerRunning = taskManagerStatus?.data?.is_running || false
  const templates = templatesData?.templates || templatesData?.data || []
  const accounts = accountsData?.data || []
  const listings = listingsData?.data || []
  const turkishCities = citiesData?.data?.cities || []
  
  // Debug templates
  if (showCreateModal && formData.task_type === 'publish_listing_all_accounts' && templatesData) {
    console.log('Templates data:', templatesData)
    console.log('Parsed templates:', templates)
  }

  const filteredTasks = tasks.filter((task: Task) =>
    task.task_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handlePauseTask = (task: Task) => {
    // TODO: Implement pause task
    console.log('Pause task:', task.id)
  }

  const handleResumeTask = (task: Task) => {
    // TODO: Implement resume task
    console.log('Resume task:', task.id)
  }

  const handleCancelTask = (task: Task) => {
    setTaskToCancel(task)
    setShowCancelModal(true)
  }

  const confirmCancelTask = async () => {
    if (!taskToCancel) return
    
    try {
      await apiClient.cancelTask(taskToCancel.id)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowCancelModal(false)
      setTaskToCancel(null)
    } catch (error) {
      console.error('Failed to cancel task:', error)
      // TODO: Show error alert instead of browser alert
    }
  }

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task)
    setShowDeleteModal(true)
  }

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return
    
    try {
      await apiClient.deleteTask(taskToDelete.id)
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowDeleteModal(false)
      setTaskToDelete(null)
    } catch (error) {
      console.error('Failed to delete task:', error)
      // TODO: Show error alert instead of browser alert
    }
  }

  const handleDeleteAllTasks = () => {
    setShowDeleteAllModal(true)
  }

  const confirmDeleteAllTasks = async () => {
    try {
      const response = await apiClient.deleteAllTasks()
      if (response.success) {
        toast.success(response.message || 'All tasks deleted successfully')
        await queryClient.invalidateQueries({ queryKey: ['tasks'] })
        setShowDeleteAllModal(false)
      } else {
        toast.error(response.message || 'Failed to delete all tasks')
      }
    } catch (error) {
      console.error('Failed to delete all tasks:', error)
      toast.error('Failed to delete all tasks')
    }
  }

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task)
    setShowDetailsModal(true)
  }

  const handleCreateTask = () => {
    setShowCreateModal(true)
  }
  
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Reset excluded cities when task type changes
    if (field === 'task_type' && value !== 'publish_listing_all_accounts') {
      setExcludedCities([])
    }
  }
  
  const resetForm = () => {
    setFormData({
      task_type: '',
      data: {},
      priority: 'medium',
      description: '',
      name: ''
    })
    setSelectedTemplateId('')
    setExcludedCities([])
  }
  
  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      return await apiClient.createTask(taskData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error) => {
      console.error('Failed to create task:', error)
    },
  })
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.task_type) {
      alert('Please select a task type')
      return
    }
    
    // Validate based on task type
    if (formData.task_type === 'publish_listing_all_accounts') {
      if (!selectedTemplateId) {
        alert('Please select a listing template')
        return
      }
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      // Find the selected template
      const selectedTemplate = templates.find(t => (t.id || t._id) === selectedTemplateId)
      if (!selectedTemplate) {
        alert('Selected template not found')
        return
      }
      // Send template_id instead of template data
      const taskData = {
        ...formData,
        data: {
          listing_data: {
            template_id: selectedTemplateId
          },
          skip_accounts_with_listings: formData.skip_accounts_with_listings !== false,
          use_proxy: formData.use_proxy === true,
          excluded_cities: excludedCities
        }
      }
      createTaskMutation.mutate(taskData)
    } else if (formData.task_type === 'accounts_check') {
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      const taskData = {
        ...formData,
        data: {
          use_proxy: formData.use_proxy === true
        }
      }
      createTaskMutation.mutate(taskData)
    } else if (formData.task_type === 'chat_monitoring') {
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      if (listings.length === 0) {
        alert('No listings found in the system. Listings will be created when you run publish tasks.')
        return
      }
      createTaskMutation.mutate(formData)
    } else if (formData.task_type === 'listing_check') {
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      if (listings.length === 0) {
        alert('No listings found in the system. Listings will be created when you run publish tasks.')
        return
      }
      const taskData = {
        ...formData,
        data: { 
          check_interval_minutes: parseInt(formData.check_interval_minutes) || 5,
          use_proxy: formData.use_proxy === true
        }
      }
      createTaskMutation.mutate(taskData)
    } else if (formData.task_type === 'change_account_names') {
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      if (!formData.name || formData.name.trim() === '') {
        alert('Please enter a name to set for all accounts.')
        return
      }
      const taskData = {
        ...formData,
        data: { 
          name: formData.name.trim(),
          use_proxy: formData.use_proxy === true
        }
      }
      createTaskMutation.mutate(taskData)
    } else if (formData.task_type === 'delete_all_listings') {
      if (accounts.length === 0) {
        alert('No accounts found in the system. Please add accounts first.')
        return
      }
      const taskData = {
        ...formData,
        data: {
          use_proxy: formData.use_proxy === true
        }
      }
      createTaskMutation.mutate(taskData)
    } else {
      createTaskMutation.mutate(formData)
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  const handleStartTaskManager = async () => {
    try {
      const response = await apiClient.startTaskManager(3) // Start with 3 workers
      if (response.success) {
        toast.success('Task manager started successfully')
        queryClient.invalidateQueries({ queryKey: ['task-manager-status'] })
      } else {
        toast.error(response.message || 'Failed to start task manager')
      }
    } catch (error) {
      toast.error('Failed to start task manager')
    }
  }

  const handleStopTaskManager = async () => {
    try {
      const response = await apiClient.stopTaskManager()
      if (response.success) {
        toast.success('Task manager stopped successfully')
        queryClient.invalidateQueries({ queryKey: ['task-manager-status'] })
      } else {
        toast.error(response.message || 'Failed to stop task manager')
      }
    } catch (error) {
      toast.error('Failed to stop task manager')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground">
              Monitor and manage background tasks and operations
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </Button>
            {tasks.length > 0 && (
              <Button 
                variant="outline"
                onClick={handleDeleteAllTasks}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete All</span>
              </Button>
            )}
            {!isTaskManagerRunning && (
              <Button 
                onClick={handleStartTaskManager}
                className="flex items-center space-x-2"
                variant="default"
              >
                <Play className="h-4 w-4" />
                <span>Start Bot</span>
              </Button>
            )}
            {isTaskManagerRunning && (
              <Button 
                onClick={handleStopTaskManager}
                className="flex items-center space-x-2"
                variant="destructive"
              >
                <Pause className="h-4 w-4" />
                <span>Stop Bot</span>
              </Button>
            )}
            <Button 
              onClick={handleCreateTask}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Task</span>
            </Button>
          </div>
        </div>

        {/* Task Manager Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Play className="h-5 w-5" />
              <span>Task Manager Status</span>
              <Badge variant={isTaskManagerRunning ? "default" : "secondary"}>
                {isTaskManagerRunning ? "Running" : "Stopped"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isTaskManagerRunning ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Active Workers</p>
                  <p className="text-2xl font-bold">{taskManagerStatus?.data?.workers_count || 0}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Queue Size</p>
                  <p className="text-2xl font-bold">{taskManagerStatus?.data?.queue_size || 0}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Processed Tasks</p>
                  <p className="text-2xl font-bold">{taskManagerStatus?.data?.processed_tasks || 0}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                Task manager is not running. Start it from the dashboard to process tasks.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Play className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks.filter((t: Task) => t.status === 'running').length}
              </div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks.filter((t: Task) => t.status === 'pending').length}
              </div>
              <p className="text-xs text-muted-foreground">Waiting to start</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks.filter((t: Task) => t.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">Successfully finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks.filter((t: Task) => t.status === 'failed').length}
              </div>
              <p className="text-xs text-muted-foreground">Need attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks by type or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task: Task) => {
                    const StatusIcon = statusIcons[task.status] || statusIcons.pending
                    const startTime = task.started_at ? new Date(task.started_at) : null
                    const endTime = task.completed_at ? new Date(task.completed_at) : null
                    const duration = startTime && endTime ? 
                      Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null

                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {taskTypeLabels[task.task_type] || task.task_type}
                            </div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`h-4 w-4 ${statusColors[task.status]}`} />
                            <Badge variant={statusVariants[task.status]}>
                              {task.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{task.progress || 0}%</span>
                            </div>
                            <Progress value={task.progress || 0} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {startTime ? startTime.toLocaleString() : 'Not started'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {duration ? `${duration}s` : task.status === 'running' ? 'Running...' : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(task)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {task.status === 'running' && (
                                <DropdownMenuItem onClick={() => handlePauseTask(task)}>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pause
                                </DropdownMenuItem>
                              )}
                              {task.status === 'paused' && (
                                <DropdownMenuItem onClick={() => handleResumeTask(task)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Resume
                                </DropdownMenuItem>
                              )}
                              {(task.status === 'pending' || task.status === 'running') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleCancelTask(task)}
                                    className="text-orange-600"
                                  >
                                    <Square className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteTask(task)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Create Task Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task_type">Task Type *</Label>
                <Select value={formData.task_type} onValueChange={(value) => handleInputChange('task_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publish_listing_all_accounts">Publish to All Accounts</SelectItem>
                    <SelectItem value="accounts_check">Check All Accounts</SelectItem>
                    <SelectItem value="proxy_check">Check All Proxies</SelectItem>
                    <SelectItem value="chat_monitoring">Chat Monitoring</SelectItem>
                    <SelectItem value="listing_check">Listing Monitor</SelectItem>
                    <SelectItem value="change_account_names">Change Account Names</SelectItem>
                    <SelectItem value="delete_all_listings">Delete All Listings</SelectItem>
                  </SelectContent>
                </Select>
                {formData.task_type && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {taskTypeDescriptions[formData.task_type]}
                  </p>
                )}
              </div>

              {formData.task_type === 'publish_listing_all_accounts' && (
                <div className="space-y-2">
                  <Label htmlFor="template">Listing Template *</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="text-ellipsis overflow-hidden">
                      <SelectValue placeholder="Select a listing template">
                        {selectedTemplateId && templates.find(t => (t.id || t._id) === selectedTemplateId) 
                          ? (() => {
                              const template = templates.find(t => (t.id || t._id) === selectedTemplateId);
                              const displayTitle = template.title.length > 40 
                                ? template.title.substring(0, 40) + '...' 
                                : template.title;
                              return `${displayTitle} - ₺${template.price}`;
                            })()
                          : "Select a listing template"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {templatesLoading ? (
                        <SelectItem value="loading" disabled>Loading templates...</SelectItem>
                      ) : templates.length === 0 ? (
                        <SelectItem value="none" disabled>No templates found. Please create templates in Settings.</SelectItem>
                      ) : (
                        templates.map((template: any) => {
                          const displayTitle = template.title.length > 50 
                            ? template.title.substring(0, 50) + '...' 
                            : template.title;
                          return (
                            <SelectItem 
                              key={template.id || template._id} 
                              value={template.id || template._id}
                              title={`${template.title} - ₺${template.price}`}
                            >
                              {displayTitle} - ₺{template.price}
                            </SelectItem>
                          )
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select a listing template from settings. This template will be published to all active accounts.
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      id="skip_accounts_with_listings"
                      checked={formData.skip_accounts_with_listings !== false}
                      onChange={(e) => handleInputChange('skip_accounts_with_listings', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="skip_accounts_with_listings" className="text-sm font-normal">
                      Skip accounts that already have successful listings
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, accounts with active listings will be skipped. Uncheck to force publish to all accounts.
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      id="use_proxy"
                      checked={formData.use_proxy === true}
                      onChange={(e) => handleInputChange('use_proxy', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="use_proxy" className="text-sm font-normal">
                      Use proxy servers for this task
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, available proxies will be assigned to accounts during task execution.
                  </p>
                  
                  <div className="space-y-2 mt-3">
                    <Label htmlFor="excluded_cities">Excluded Cities</Label>
                    <Select 
                      value="select-city"
                      onValueChange={(city) => {
                        if (city && !excludedCities.includes(city)) {
                          setExcludedCities([...excludedCities, city])
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select cities to exclude" />
                      </SelectTrigger>
                      <SelectContent>
                        {turkishCities.map((city: string) => (
                          <SelectItem 
                            key={city} 
                            value={city}
                            disabled={excludedCities.includes(city)}
                          >
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Select cities where listings should not be published. Accounts will not be assigned to these cities.
                    </p>
                    {excludedCities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {excludedCities.map((city) => (
                          <Badge 
                            key={city} 
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => setExcludedCities(excludedCities.filter(c => c !== city))}
                          >
                            {city} ✕
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                </div>
              )}

              {(formData.task_type === 'chat_monitoring' || formData.task_type === 'listing_check') && (
                <div className="space-y-2">
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                  {listings.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No listings found. Listings will be created when you run publish tasks.
                    </p>
                  )}
                </div>
              )}

              {formData.task_type === 'accounts_check' && (
                <>
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      id="use_proxy_check"
                      checked={formData.use_proxy === true}
                      onChange={(e) => handleInputChange('use_proxy', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="use_proxy_check" className="text-sm font-normal">
                      Use proxy servers for account checking
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, available proxies will be assigned to accounts during verification.
                  </p>
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500 mt-2">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                </>
              )}

              {formData.task_type === 'listing_check' && (
                <div className="space-y-2">
                  <Label htmlFor="check_interval">Check Interval (minutes) *</Label>
                  <Input
                    id="check_interval"
                    type="number"
                    min="1"
                    max="60"
                    placeholder="Enter check interval in minutes (default: 5)"
                    value={formData.check_interval_minutes || 5}
                    onChange={(e) => handleInputChange('check_interval_minutes', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    How often to check and republish closed listings (1-60 minutes).
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      id="use_proxy_listing_check"
                      checked={formData.use_proxy === true}
                      onChange={(e) => handleInputChange('use_proxy', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="use_proxy_listing_check" className="text-sm font-normal">
                      Use proxy servers for listing checks
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, available proxies will be assigned to accounts during listing checks.
                  </p>
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                  {listings.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No listings found. Listings will be created when you run publish tasks.
                    </p>
                  )}
                </div>
              )}
              {formData.task_type === 'change_account_names' && (
                <div className="space-y-2">
                  <Label htmlFor="account_name">New Account Name *</Label>
                  <Input
                    id="account_name"
                    type="text"
                    placeholder="Enter the name to set for all accounts"
                    value={formData.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    This name will be set as the display name for all accounts.
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-3">
                    <input
                      type="checkbox"
                      id="use_proxy_name_change"
                      checked={formData.use_proxy === true}
                      onChange={(e) => handleInputChange('use_proxy', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="use_proxy_name_change" className="text-sm font-normal">
                      Use proxy servers for name changes
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, available proxies will be assigned to accounts during name changes.
                  </p>
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                </div>
              )}
              
              {formData.task_type === 'delete_all_listings' && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="use_proxy_delete"
                      checked={formData.use_proxy === true}
                      onChange={(e) => handleInputChange('use_proxy', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="use_proxy_delete" className="text-sm font-normal">
                      Use proxy servers for this task
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When checked, available proxies will be assigned to accounts during deletion.
                  </p>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800 font-medium">⚠️ Warning: This action cannot be undone!</p>
                    <p className="text-xs text-red-600 mt-1">
                      This will permanently delete ALL active listings from ALL accounts in the system.
                    </p>
                  </div>
                  {accounts.length === 0 && (
                    <p className="text-sm text-red-500">
                      Warning: No accounts found. Please add accounts before creating this task.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter task description (optional)"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                >
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Task Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Task Details</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Task ID</Label>
                    <p className="text-sm text-muted-foreground">{selectedTask.id}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p className="text-sm text-muted-foreground">
                      {taskTypeLabels[selectedTask.task_type] || selectedTask.task_type}
                    </p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge variant={statusVariants[selectedTask.status]}>
                      {selectedTask.status}
                    </Badge>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <p className="text-sm text-muted-foreground">{selectedTask.priority}</p>
                  </div>
                  <div>
                    <Label>Created At</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date(selectedTask.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <Label>Progress</Label>
                    <div className="space-y-1">
                      <Progress value={selectedTask.progress || 0} />
                      <p className="text-sm text-muted-foreground">{selectedTask.progress || 0}%</p>
                    </div>
                  </div>
                </div>
                
                {selectedTask.description && (
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                  </div>
                )}
                
                {selectedTask.result && (
                  <div>
                    <Label>Result</Label>
                    <div className="bg-muted p-3 rounded-md">
                      {selectedTask.task_type === 'proxy_check' && selectedTask.result && (
                        <div className="space-y-2">
                          <p className="text-sm">
                            Total Proxies: {selectedTask.result.total_proxies || 0}
                          </p>
                          <p className="text-sm text-green-600">
                            Working: {selectedTask.result.working_count || 0}
                          </p>
                          <p className="text-sm text-red-600">
                            Failed: {selectedTask.result.failed_count || 0}
                          </p>
                        </div>
                      )}
                      {selectedTask.task_type === 'accounts_check' && selectedTask.result && (
                        <div className="space-y-2">
                          <p className="text-sm">
                            Total Accounts: {selectedTask.result.total_accounts || 0}
                          </p>
                          <p className="text-sm text-green-600">
                            Checked: {selectedTask.result.checked_count || 0}
                          </p>
                          <p className="text-sm text-red-600">
                            Failed: {selectedTask.result.failed_count || 0}
                          </p>
                        </div>
                      )}
                      {selectedTask.task_type === 'publish_listing_all_accounts' && selectedTask.result && (
                        <div className="space-y-2">
                          <p className="text-sm">
                            Total Accounts: {selectedTask.result.total_accounts || 0}
                          </p>
                          <p className="text-sm text-green-600">
                            Published: {selectedTask.result.published_count || 0}
                          </p>
                          <p className="text-sm text-red-600">
                            Failed: {selectedTask.result.failed_count || 0}
                          </p>
                        </div>
                      )}
                      {!['proxy_check', 'accounts_check', 'publish_listing_all_accounts'].includes(selectedTask.task_type) && (
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(selectedTask.result, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
                
                {selectedTask.error && (
                  <div>
                    <Label className="text-red-600">Error</Label>
                    <p className="text-sm text-red-600">{selectedTask.error}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Task</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {taskToDelete && (
              <div className="py-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Task:</span>
                    <span className="text-muted-foreground">
                      {taskTypeLabels[taskToDelete.task_type] || taskToDelete.task_type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Status:</span>
                    <Badge variant={statusVariants[taskToDelete.status]}>
                      {taskToDelete.status}
                    </Badge>
                  </div>
                  {taskToDelete.description && (
                    <div className="flex items-start space-x-2">
                      <span className="font-medium">Description:</span>
                      <span className="text-muted-foreground text-sm">
                        {taskToDelete.description}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setTaskToDelete(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteTask}
              >
                Delete Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Task Confirmation Modal */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Cancel Task</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this task? The task will be stopped and marked as cancelled.
              </DialogDescription>
            </DialogHeader>
            {taskToCancel && (
              <div className="py-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Task:</span>
                    <span className="text-muted-foreground">
                      {taskTypeLabels[taskToCancel.task_type] || taskToCancel.task_type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Status:</span>
                    <Badge variant={statusVariants[taskToCancel.status]}>
                      {taskToCancel.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Progress:</span>
                    <span className="text-muted-foreground">
                      {taskToCancel.progress || 0}%
                    </span>
                  </div>
                  {taskToCancel.description && (
                    <div className="flex items-start space-x-2">
                      <span className="font-medium">Description:</span>
                      <span className="text-muted-foreground text-sm">
                        {taskToCancel.description}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelModal(false)
                  setTaskToCancel(null)
                }}
              >
                Keep Running
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancelTask}
              >
                Cancel Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete All Tasks Confirmation Modal */}
        <Dialog open={showDeleteAllModal} onOpenChange={setShowDeleteAllModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete All Tasks</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete all tasks? This will permanently remove {tasks.length} task{tasks.length !== 1 ? 's' : ''} from the system. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Total Tasks:</span>
                  <span className="text-muted-foreground">{tasks.length}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Running Tasks:</span>
                  <span className="text-muted-foreground">
                    {tasks.filter((t: Task) => t.status === 'running').length}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Pending Tasks:</span>
                  <span className="text-muted-foreground">
                    {tasks.filter((t: Task) => t.status === 'pending').length}
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <strong>Warning:</strong> This will delete all tasks including running and pending ones. Running tasks will be cancelled first.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteAllModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteAllTasks}
              >
                Delete All Tasks
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}