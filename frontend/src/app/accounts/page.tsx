/**
 * Accounts Management Page
 * List, create, edit, and manage Letgo accounts
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  Lock,
  Mail,
  Cookie,
  Upload,
  AlertCircle,
  Check,
  Info
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiClient, Account, AccountType } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import toast from 'react-hot-toast'

const statusIcons = {
  active: CheckCircle,
  inactive: XCircle,
  suspended: XCircle,
  pending: Clock,
  banned: XCircle,
  error: XCircle,
  cookie_error: XCircle,
}

const statusColors = {
  active: 'text-green-500',
  inactive: 'text-gray-400',
  suspended: 'text-red-500',
  pending: 'text-yellow-500',
  banned: 'text-red-600',
  error: 'text-red-500',
  cookie_error: 'text-orange-500',
}

const statusVariants = {
  active: 'default' as const,
  inactive: 'secondary' as const,
  suspended: 'destructive' as const,
  pending: 'outline' as const,
  banned: 'destructive' as const,
  error: 'destructive' as const,
  cookie_error: 'destructive' as const,
}

const accountTypeIcons = {
  letgo_cookies: Cookie,
}

const accountTypeLabels = {
  letgo_cookies: 'Letgo Direct',
}

export default function AccountsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showCookies, setShowCookies] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single')
  const accountType: AccountType = 'letgo_cookies'
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [detailsAccount, setDetailsAccount] = useState<Account | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    cookies: '',
    recovery_email: '',
    phone: '',
  })
  
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  
  const queryClient = useQueryClient()
  
  // Fetch accounts
  const { data: accountsResponse, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.getAccounts(),
  })
  
  const accounts = (accountsResponse?.data || []).map((acc: any) => ({
    ...acc,
    id: acc.id || acc._id
  }))

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      if (addMode === 'bulk') {
        // Parse bulk files
        const accounts = await parseBulkFiles(bulkFiles)
        return apiClient.post('/api/accounts/bulk', { accounts })
      } else {
        // Single account creation
        const accountData: any = {
          account_type: accountType,
        }
        
        // Parse cookies to ensure it's a list
        try {
          if (typeof data.cookies === 'string') {
            accountData.cookies = JSON.parse(data.cookies)
          } else {
            accountData.cookies = data.cookies
          }
        } catch {
          throw new Error('Invalid cookie format')
        }
        
        return apiClient.createAccount(accountData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddModal(false)
      resetForm()
    },
  })

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) => apiClient.deleteAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      setShowDeleteDialog(false)
      setAccountToDelete(null)
      toast.success('Account deleted successfully')
    },
    onError: (error: any) => {
      console.error('Failed to delete account:', error)
      toast.error(error.message || 'Failed to delete account')
      setShowDeleteDialog(false)
      setAccountToDelete(null)
    },
  })

  const filteredAccounts = accounts.filter((account: Account) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      account.email?.toLowerCase().includes(searchLower) ||
      account.display_name?.toLowerCase().includes(searchLower) ||
      account.name?.toLowerCase().includes(searchLower)
    )
  })

  const handleAddAccount = () => {
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      cookies: '',
      recovery_email: '',
      phone: '',
    })
    setBulkFiles([])
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (addMode === 'single') {
      // Validate Letgo cookies
      if (!formData.cookies) {
        alert('Cookies are required for Letgo accounts')
        return
      }
    } else {
      // Validate bulk files
      if (bulkFiles.length === 0) {
        alert('Please select JSON cookie files')
        return
      }
    }
    
    createAccountMutation.mutate(formData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const parseBulkFiles = async (files: File[]) => {
    const accounts = []
    
    for (const file of files) {
      try {
        const content = await file.text()
        const cookies = JSON.parse(content)
        
        // Ensure cookies is an array
        if (!Array.isArray(cookies)) {
          throw new Error('Cookie file must contain a JSON array')
        }
        
        accounts.push({
          account_type: 'letgo_cookies',
          cookies: cookies
        })
      } catch (error) {
        throw new Error(`Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
      }
    }
    
    return accounts
  }
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const jsonFiles = files.filter(file => file.name.endsWith('.json'))
    
    if (jsonFiles.length !== files.length) {
      alert('Please select only JSON files')
      return
    }
    
    setBulkFiles(jsonFiles)
  }
  
  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const jsonFiles = files.filter(file => file.name.endsWith('.json'))
    
    if (jsonFiles.length !== files.length) {
      alert('Please select only JSON files')
      return
    }
    
    setBulkFiles(jsonFiles)
  }
  
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }


  const handleDelete = (accountId: string) => {
    setAccountToDelete(accountId)
    setShowDeleteDialog(true)
  }


  const handleViewDetails = (account: Account) => {
    setDetailsAccount(account)
    setShowDetailsModal(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="text-muted-foreground mt-2">
              Manage your Google and Letgo accounts
            </p>
          </div>
          <Button onClick={handleAddAccount}>
            <Plus className="mr-2 h-4 w-4" />
            Add Accounts
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts.length}</div>
              <p className="text-xs text-muted-foreground">All accounts</p>
            </CardContent>
          </Card>
          
          <Card className="border-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts.filter((a: Account) => a.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">Ready for use</p>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts.filter((a: Account) => a.status === 'pending').length}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting verification</p>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {accounts.filter((a: Account) => a.status === 'suspended' || a.status === 'inactive').length}
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
                placeholder="Search accounts by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Accounts Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Listings</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading accounts...
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account: Account) => {
                    const StatusIcon = statusIcons[account.status]
                    const TypeIcon = accountTypeIcons.letgo_cookies
                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {account.email || 'No Email'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {account.display_name || account.name || 'No Name'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {accountTypeLabels.letgo_cookies}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`h-4 w-4 ${statusColors[account.status]}`} />
                            <Badge variant={statusVariants[account.status]}>
                              {account.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            <div>Total: {account.total_listings || 0}</div>
                            <div className="text-muted-foreground">
                              Successful: {account.successful_listings || 0}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.assigned_proxy ? (
                            <div className="text-sm">
                              {account.assigned_proxy.ip}:{account.assigned_proxy.port}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No proxy</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(account.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(account)}>
                                <Info className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setShowCookies(account.id)}>
                                {showCookies === account.id ? (
                                  <>
                                    <EyeOff className="mr-2 h-4 w-4" />
                                    Hide Cookies
                                  </>
                                ) : (
                                  <>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Cookies
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  console.log('Delete clicked for account:', account.id)
                                  handleDelete(account.id)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
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

        {/* Cookies Display */}
        {showCookies && (
          <Card>
            <CardHeader>
              <CardTitle>Cookies for Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-auto">
                {(() => {
                  const account = accounts.find((a: Account) => a.id === showCookies)
                  if (!account) return 'Account not found'
                  if (!account.cookies || account.cookies.length === 0) return 'No cookies available'
                  return account.cookies.map((cookie: any, index: number) => (
                    <div key={index}>
                      {cookie.name}: {cookie.value}
                    </div>
                  ))
                })()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Account Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add Accounts</DialogTitle>
            </DialogHeader>
            
            <Tabs value={addMode} onValueChange={(v) => setAddMode(v as 'single' | 'bulk')} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                <TabsTrigger value="single">Single Account</TabsTrigger>
                <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
              </TabsList>
              
              <TabsContent value="single" className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto pr-1 sm:pr-2 pb-4">
                  <form id="account-form" onSubmit={handleFormSubmit} className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Select Account Type</Label>
                      <div className="flex items-center justify-center p-6 bg-muted/30 rounded-lg border-2 border-dashed">
                        <div className="text-center space-y-2">
                          <Cookie className="h-8 w-8 mx-auto text-primary" />
                          <p className="text-sm font-medium">Letgo Direct</p>
                          <p className="text-xs text-muted-foreground">Import Letgo cookies directly</p>
                        </div>
                      </div>
                    </div>
                  
                  
                    {accountType === 'letgo_cookies' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="cookies">Cookies (JSON) *</Label>
                          {formData.cookies && (
                            <div className="flex items-center gap-1 text-xs">
                              {(() => {
                                try {
                                  JSON.parse(formData.cookies)
                                  return (
                                    <>
                                      <Check className="h-3 w-3 text-green-500" />
                                      <span className="text-green-500">Valid JSON</span>
                                    </>
                                  )
                                } catch {
                                  return (
                                    <>
                                      <AlertCircle className="h-3 w-3 text-red-500" />
                                      <span className="text-red-500">Invalid JSON</span>
                                    </>
                                  )
                                }
                              })()}
                            </div>
                          )}
                        </div>
                        <Textarea
                          id="cookies"
                          value={formData.cookies}
                          onChange={(e) => handleInputChange('cookies', e.target.value)}
                          placeholder="Paste Letgo cookies as JSON array"
                          className="font-mono text-xs h-[200px] w-full resize-none overflow-y-auto whitespace-pre break-all"
                          required
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <p>Export cookies from browser DevTools or extensions</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              try {
                                const formatted = JSON.stringify(JSON.parse(formData.cookies), null, 2)
                                handleInputChange('cookies', formatted)
                              } catch {
                                // Invalid JSON, ignore
                              }
                            }}
                          >
                            Format JSON
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              </TabsContent>
              
              <TabsContent value="bulk" className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto pr-1 sm:pr-2 pb-4">
                  <form id="account-form-bulk" onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="flex items-center justify-center p-6 bg-muted/30 rounded-lg border-2 border-dashed">
                      <div className="text-center space-y-2">
                        <Upload className="h-8 w-8 mx-auto text-primary" />
                        <p className="text-sm font-medium">Bulk Import Letgo Cookies</p>
                        <p className="text-xs text-muted-foreground">Import multiple JSON cookie files</p>
                      </div>
                    </div>
                  
                    <div className="space-y-2">
                      <Label htmlFor="bulk_files">Upload JSON Cookie Files *</Label>
                      <div className="p-3 bg-muted rounded-lg space-y-1 text-xs">
                        <p className="font-medium">Select multiple JSON files</p>
                        <p className="text-muted-foreground">Each file should contain a Letgo cookie array</p>
                      </div>
                      
                      <div className="space-y-4">
                        <div 
                          className="relative border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                          onDrop={handleFileDrop}
                          onDragOver={handleDragOver}
                          onClick={() => document.getElementById('bulk_files')?.click()}
                        >
                          <input
                            id="bulk_files"
                            type="file"
                            multiple
                            accept=".json"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                          <div className="space-y-2 pointer-events-none">
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Drop JSON files here or click to browse</p>
                              <p className="text-xs text-muted-foreground mt-1">Select multiple .json files</p>
                            </div>
                          </div>
                        </div>
                        
                        {bulkFiles.length > 0 && (
                          <div className="p-3 bg-muted rounded border">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-medium">{bulkFiles.length} files selected</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setBulkFiles([])
                                  const input = document.getElementById('bulk_files') as HTMLInputElement
                                  if (input) input.value = ''
                                }}
                              >
                                Clear all
                              </Button>
                            </div>
                            <div className="max-h-48 sm:max-h-60 overflow-y-auto border rounded bg-background">
                              <div className="divide-y">
                                {bulkFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 hover:bg-accent/50 gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-mono truncate break-all" title={file.name}>
                                        {file.name}
                                      </p>
                                    </div>
                                    <div className="text-xs text-muted-foreground shrink-0 text-right">
                                      {(file.size / 1024).toFixed(1)}KB
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={addMode === 'single' ? 'account-form' : 'account-form-bulk'}
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending 
                  ? (addMode === 'bulk' ? 'Importing...' : 'Creating...') 
                  : (addMode === 'bulk' ? 'Import Accounts' : 'Create Account')
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={(open) => {
          setShowDeleteDialog(open)
          if (!open) {
            setAccountToDelete(null)
          }
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this account? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setAccountToDelete(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (accountToDelete) {
                    console.log('Deleting account:', accountToDelete)
                    deleteAccountMutation.mutate(accountToDelete)
                  }
                }}
                disabled={deleteAccountMutation.isPending || !accountToDelete}
              >
                {deleteAccountMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Account Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Account Details</DialogTitle>
              <DialogDescription>
                Complete information about the account
              </DialogDescription>
            </DialogHeader>
            {detailsAccount && (
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Account Type</Label>
                    <p className="font-medium">{accountTypeLabels.letgo_cookies}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const StatusIcon = statusIcons[detailsAccount.status]
                        return (
                          <>
                            <StatusIcon className={`h-4 w-4 ${statusColors[detailsAccount.status]}`} />
                            <Badge variant={statusVariants[detailsAccount.status]}>
                              {detailsAccount.status}
                            </Badge>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{detailsAccount.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Display Name</Label>
                    <p className="font-medium">{detailsAccount.display_name || detailsAccount.name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created At</Label>
                    <p className="font-medium">{new Date(detailsAccount.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Updated At</Label>
                    <p className="font-medium">{new Date(detailsAccount.updated_at).toLocaleString()}</p>
                  </div>
                </div>

                <div data-orientation="horizontal" role="separator" className="bg-border h-px w-full" />

                <div className="space-y-4">
                  <h3 className="font-semibold">Listing Statistics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Total Listings</Label>
                      <p className="text-2xl font-bold">{detailsAccount.total_listings || 0}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Active Listings</Label>
                      <p className="text-2xl font-bold text-green-600">{detailsAccount.active_listings || 0}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Published Listings</Label>
                      <p className="text-2xl font-bold text-blue-600">{detailsAccount.published_listings || 0}</p>
                    </div>
                  </div>
                </div>

                {detailsAccount.assigned_proxy && (
                  <>
                    <div data-orientation="horizontal" role="separator" className="bg-border h-px w-full" />
                    <div className="space-y-2">
                      <h3 className="font-semibold">Proxy Information</h3>
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="font-mono text-sm">
                          {detailsAccount.assigned_proxy.ip}:{detailsAccount.assigned_proxy.port}
                        </p>
                        {detailsAccount.assigned_proxy.username && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Username: {detailsAccount.assigned_proxy.username}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div data-orientation="horizontal" role="separator" className="bg-border h-px w-full" />

                <div className="space-y-2">
                  <h3 className="font-semibold">Cookies ({detailsAccount.cookies?.length || 0})</h3>
                  <div className="bg-muted p-3 rounded-lg max-h-[200px] overflow-y-auto">
                    <pre className="font-mono text-xs whitespace-pre-wrap">
                      {JSON.stringify(detailsAccount.cookies, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="flex-shrink-0 pt-4">
              <Button
                onClick={() => {
                  setShowDetailsModal(false)
                  setDetailsAccount(null)
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}