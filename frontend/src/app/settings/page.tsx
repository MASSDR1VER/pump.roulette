/**
 * Settings Page
 * Configure application settings and preferences
 */

'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Settings,
  Server,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ListingTemplateForm } from './ListingTemplateForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient } from '@/lib/api-client'

interface ProxyEntry {
  id: string
  ip: string
  port: number
  username: string
  password: string
  status: 'active' | 'inactive' | 'error' | 'checking'
  selected?: boolean
}

export default function SettingsPage() {
  const [showPasswords, setShowPasswords] = useState(false)
  const [newProxy, setNewProxy] = useState({
    ip: '',
    port: '',
    username: '',
    password: ''
  })
  const [proxies, setProxies] = useState<ProxyEntry[]>([])
  const [selectedProxies, setSelectedProxies] = useState<Set<string>>(new Set())
  const [isCheckingProxies, setIsCheckingProxies] = useState(false)
  const [proxyStats, setProxyStats] = useState({
    total: 0,
    active: 0,
    error: 0
  })
  const [selectedCaptchaService, setSelectedCaptchaService] = useState('capmonster')
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false)

  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
  })

  // Extract values from settings objects
  const rawSettings = settingsData?.data || {}
  const settings = Object.entries(rawSettings).reduce((acc, [key, setting]) => {
    acc[key] = setting?.value !== undefined ? setting.value : setting
    return acc
  }, {} as Record<string, any>)

  // Fetch proxies from database
  const { data: proxiesData, refetch: refetchProxies } = useQuery({
    queryKey: ['proxies'],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies?limit=1000`)
      if (!response.ok) throw new Error('Failed to fetch proxies')
      return response.json()
    },
  })

  // Initialize proxies from database
  useEffect(() => {
    if (proxiesData?.data) {
      const formattedProxies = proxiesData.data.map((proxy: any) => ({
        id: proxy._id || proxy.id,
        ip: proxy.ip,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        status: (proxy.status || 'inactive') as 'active' | 'inactive' | 'error' | 'checking'
      }))
      setProxies(formattedProxies)
      updateProxyStats(formattedProxies)
    }
  }, [proxiesData])

  const updateProxyStats = (proxyList: ProxyEntry[]) => {
    const stats = {
      total: proxyList.length,
      active: proxyList.filter(p => p.status === 'active').length,
      error: proxyList.filter(p => p.status === 'error').length
    }
    setProxyStats(stats)
  }

  const handleSaveSettings = async () => {
    try {
      // Get captcha API key values
      const capmonsterInput = document.getElementById('capmonster-api-key') as HTMLInputElement
      const capsolverInput = document.getElementById('capsolver-api-key') as HTMLInputElement
      
      const updates: any = {}
      
      if (capmonsterInput && capmonsterInput.value) {
        updates.capmonster_api_key = capmonsterInput.value
      }
      
      if (capsolverInput && capsolverInput.value) {
        updates.capsolver_api_key = capsolverInput.value
      }
      
      // Save settings
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (response.ok) {
        console.log('Settings saved successfully')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const checkProxy = async (proxy: ProxyEntry) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: proxy.ip,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        })
      })
      const result = await response.json()
      return result.success ? 'active' : 'error'
    } catch (error) {
      return 'error'
    }
  }

  const saveProxyToDatabase = async (proxy: ProxyEntry) => {
    try {
      // Always check proxy first
      const status = await checkProxy(proxy)
      
      // Only save if check was successful
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: proxy.ip,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
          proxy_type: 'http'
        })
      })
      const result = await response.json()
      
      // Update status after creation
      if (result.data && result.data._id) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${result.data._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        })
      }
      
      return { proxy: result.data, status }
    } catch (error) {
      console.error('Failed to save proxy:', error)
      return null
    }
  }

  const handleAddProxy = async () => {
    if (!newProxy.ip || !newProxy.port) return
    
    const tempId = Date.now().toString()
    const proxyToAdd: ProxyEntry = {
      id: tempId,
      ip: newProxy.ip,
      port: parseInt(newProxy.port),
      username: newProxy.username,
      password: newProxy.password,
      status: 'checking'
    }
    
    // Add to UI immediately with checking status
    setProxies(prev => {
      const newProxies = [...prev, proxyToAdd]
      updateProxyStats(newProxies)
      return newProxies
    })
    
    // Check and save to database
    const result = await saveProxyToDatabase(proxyToAdd)
    
    if (result && result.proxy) {
      // Update with real ID and checked status
      setProxies(prev => {
        const updated = prev.map(p => 
          p.id === tempId ? { ...p, id: result.proxy._id, status: result.status as 'active' | 'inactive' | 'error' | 'checking' } : p
        )
        updateProxyStats(updated)
        return updated
      })
    } else {
      // Remove from list if save failed
      setProxies(prev => prev.filter(p => p.id !== tempId))
    }
    
    setNewProxy({ ip: '', port: '', username: '', password: '' })
  }

  const handleDeleteProxy = async (proxyId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${proxyId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setProxies(prev => prev.filter(p => p.id !== proxyId))
        setSelectedProxies(prev => {
          const newSet = new Set(prev)
          newSet.delete(proxyId)
          return newSet
        })
        updateProxyStats(proxies.filter(p => p.id !== proxyId))
      }
    } catch (error) {
      console.error('Failed to delete proxy:', error)
    }
  }

  const handleBulkDelete = async () => {
    try {
      // Delete each selected proxy from database
      const deletePromises = Array.from(selectedProxies).map(proxyId => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${proxyId}`, {
          method: 'DELETE'
        })
      )
      
      await Promise.all(deletePromises)
      
      setProxies(prev => prev.filter(p => !selectedProxies.has(p.id)))
      setSelectedProxies(new Set())
      updateProxyStats(proxies.filter(p => !selectedProxies.has(p.id)))
    } catch (error) {
      console.error('Failed to delete proxies:', error)
    }
  }

  const handleTestProxy = async (proxyId: string) => {
    setProxies(prev => {
      const updated = prev.map(p => 
        p.id === proxyId ? { ...p, status: 'checking' as const } : p
      )
      updateProxyStats(updated)
      return updated
    })
    
    const proxy = proxies.find(p => p.id === proxyId)
    if (proxy) {
      const status = await checkProxy(proxy)
      
      // Update status in database
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${proxyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      setProxies(prev => {
        const updated = prev.map(p => 
          p.id === proxyId ? { ...p, status: status as 'active' | 'inactive' | 'error' | 'checking' } : p
        )
        updateProxyStats(updated)
        return updated
      })
    }
  }

  const toggleProxySelection = (proxyId: string) => {
    setSelectedProxies(prev => {
      const newSet = new Set(prev)
      if (newSet.has(proxyId)) {
        newSet.delete(proxyId)
      } else {
        newSet.add(proxyId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedProxies.size === proxies.length) {
      setSelectedProxies(new Set())
    } else {
      setSelectedProxies(new Set(proxies.map(p => p.id)))
    }
  }

  const handleBulkProxyUpload = async () => {
    const textarea = document.getElementById('bulk-proxies') as HTMLTextAreaElement
    if (!textarea || !textarea.value.trim()) return
    
    setIsCheckingProxies(true)
    const lines = textarea.value.trim().split('\n')
    const tempProxies: ProxyEntry[] = []
    
    // Parse proxies
    for (const line of lines) {
      const match = line.match(/^(.+):(.+)@(.+):(\d+)$/)
      if (match) {
        const proxy: ProxyEntry = {
          id: Date.now().toString() + Math.random(),
          username: match[1],
          password: match[2],
          ip: match[3],
          port: parseInt(match[4]),
          status: 'checking'
        }
        tempProxies.push(proxy)
      }
    }
    
    // Add all proxies to UI immediately with "checking" status
    setProxies(prev => [...prev, ...tempProxies])
    updateProxyStats([...proxies, ...tempProxies])
    
    // Check and save each proxy
    for (const proxy of tempProxies) {
      try {
        // Check proxy first
        const status = await checkProxy(proxy)
        
        // Save to database with the checked status
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: proxy.ip,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            proxy_type: 'http'
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          const savedProxy = result.data
          
          // Update status in database
          if (savedProxy && savedProxy._id) {
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${savedProxy._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status })
            })
            
            // Update in UI with real ID and status
            setProxies(prev => prev.map(p => 
              p.id === proxy.id ? { ...p, id: savedProxy._id, status: status as 'active' | 'inactive' | 'error' | 'checking' } : p
            ))
          }
        } else {
          // Remove from UI if save failed
          setProxies(prev => prev.filter(p => p.id !== proxy.id))
        }
        
        // Update stats in real-time
        setProxies(prev => {
          updateProxyStats(prev)
          return prev
        })
      } catch (error) {
        console.error('Failed to process proxy:', error)
        // Remove failed proxy from UI
        setProxies(prev => prev.filter(p => p.id !== proxy.id))
      }
    }
    
    setIsCheckingProxies(false)
    textarea.value = ''
    
    // Final refresh from database
    refetchProxies()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure application settings and preferences
            </p>
          </div>
          <Button onClick={handleSaveSettings} className="flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </Button>
        </div>

        <Tabs defaultValue="proxies" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="proxies">Proxies</TabsTrigger>
            <TabsTrigger value="listings">Listing Templates</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>


          {/* Proxy Settings */}
          <TabsContent value="proxies" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Server className="h-5 w-5" />
                      <span>Proxy Configuration</span>
                    </CardTitle>
                    <div className="flex items-center divide-x divide-gray-200 mt-3">
                      <div className="pr-6">
                        <p className="text-xs text-muted-foreground">Total Proxies</p>
                        <p className="text-2xl font-semibold">{proxyStats.total}</p>
                      </div>
                      <div className="px-6">
                        <p className="text-xs text-muted-foreground">Active</p>
                        <p className="text-2xl font-semibold">{proxyStats.active}</p>
                      </div>
                      <div className="pl-6">
                        <p className="text-xs text-muted-foreground">Failed</p>
                        <p className="text-2xl font-semibold">{proxyStats.error}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {proxies.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteAllDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All
                      </Button>
                    )}
                    {selectedProxies.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected ({selectedProxies.size})
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? (
                        <EyeOff className="h-4 w-4 mr-2" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      {showPasswords ? 'Hide' : 'Show'} Passwords
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add New Proxy */}
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">Add New Proxy</h3>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="proxy-ip">IP Address</Label>
                      <Input 
                        id="proxy-ip"
                        value={newProxy.ip}
                        onChange={(e) => setNewProxy({...newProxy, ip: e.target.value})}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proxy-port">Port</Label>
                      <Input 
                        id="proxy-port"
                        type="number"
                        value={newProxy.port}
                        onChange={(e) => setNewProxy({...newProxy, port: e.target.value})}
                        placeholder="8080"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proxy-username">Username</Label>
                      <Input 
                        id="proxy-username"
                        value={newProxy.username}
                        onChange={(e) => setNewProxy({...newProxy, username: e.target.value})}
                        placeholder="username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proxy-password">Password</Label>
                      <Input 
                        id="proxy-password"
                        type="password"
                        value={newProxy.password}
                        onChange={(e) => setNewProxy({...newProxy, password: e.target.value})}
                        placeholder="password"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddProxy} className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add Proxy</span>
                  </Button>
                </div>

                {/* Bulk Proxy Upload */}
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-medium">Bulk Proxy Upload</h3>
                  <div className="space-y-2">
                    <Label htmlFor="bulk-proxies">Proxy List (Format: user:pass@ip:port)</Label>
                    <Textarea 
                      id="bulk-proxies"
                      placeholder="user1:pass1@192.168.1.100:8080\nuser2:pass2@192.168.1.101:8080\nuser3:pass3@192.168.1.102:8080"
                      className="h-[120px] min-h-[120px] max-h-[120px] resize-none font-mono text-sm"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter one proxy per line in format: username:password@ip:port
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleBulkProxyUpload()} 
                    className="flex items-center space-x-2"
                    disabled={isCheckingProxies}
                  >
                    {isCheckingProxies ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Checking Proxies...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Upload Proxies</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Existing Proxies */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Configured Proxies</h3>
                    {proxies.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedProxies.size === proxies.length && proxies.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                        <Label className="text-sm">Select All</Label>
                      </div>
                    )}
                  </div>
                  {proxies.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No proxies configured
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {proxies.map((proxy) => (
                        <div key={proxy.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedProxies.has(proxy.id)}
                                onChange={() => toggleProxySelection(proxy.id)}
                                className="rounded border-gray-300"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">
                                    {proxy.ip}:{proxy.port}
                                  </span>
                                  {proxy.status === 'checking' && (
                                    <span className="text-xs text-muted-foreground flex items-center space-x-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>Checking</span>
                                    </span>
                                  )}
                                  {proxy.status === 'active' && (
                                    <span className="text-xs text-muted-foreground">
                                      Active
                                    </span>
                                  )}
                                  {proxy.status === 'error' && (
                                    <span className="text-xs text-muted-foreground">
                                      Failed
                                    </span>
                                  )}
                                  {proxy.status === 'inactive' && (
                                    <span className="text-xs text-muted-foreground">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Username: {proxy.username} • 
                                  Password: {showPasswords ? proxy.password : '••••••••'}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleTestProxy(proxy.id)}
                                disabled={proxy.status === 'checking'}
                              >
                                {proxy.status === 'checking' ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  'Test'
                                )}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleDeleteProxy(proxy.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Listing Templates Settings */}
          <TabsContent value="listings" className="space-y-6">
            <ListingTemplateForm settings={settings} />
          </TabsContent>

          {/* Services Settings */}
          <TabsContent value="services" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Captcha Solver Service</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="captcha-service">Service Provider</Label>
                    <Select 
                      value={selectedCaptchaService}
                      onValueChange={setSelectedCaptchaService}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="capmonster">CapMonster</SelectItem>
                        <SelectItem value="capsolver">CapSolver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {selectedCaptchaService === 'capmonster' && (
                    <div className="space-y-2">
                      <Label htmlFor="capmonster-api-key">API Key</Label>
                      <Input 
                        id="capmonster-api-key" 
                        type="password"
                        defaultValue={settings.capmonster_api_key || ""}
                        placeholder="Enter your CapMonster API key"
                      />
                      <p className="text-sm text-muted-foreground">
                        Get your API key from capmonster.cloud
                      </p>
                    </div>
                  )}

                  {selectedCaptchaService === 'capsolver' && (
                    <div className="space-y-2">
                      <Label htmlFor="capsolver-api-key">API Key</Label>
                      <Input 
                        id="capsolver-api-key" 
                        type="password"
                        defaultValue={settings.capsolver_api_key || ""}
                        placeholder="Enter your CapSolver API key"
                      />
                      <p className="text-sm text-muted-foreground">
                        Get your API key from capsolver.com
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Delete All Proxies</span>
            </DialogTitle>
            <DialogDescription className="pt-3">
              Are you sure you want to delete all {proxies.length} proxies? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteAllDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  // Delete all proxies from database
                  const deletePromises = proxies.map(proxy => 
                    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/proxies/${proxy.id}`, {
                      method: 'DELETE'
                    })
                  )
                  
                  await Promise.all(deletePromises)
                  
                  setProxies([])
                  setSelectedProxies(new Set())
                  updateProxyStats([])
                  setShowDeleteAllDialog(false)
                } catch (error) {
                  console.error('Failed to delete all proxies:', error)
                }
              }}
            >
              Delete All Proxies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
