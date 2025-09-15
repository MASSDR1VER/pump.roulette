/**
 * Listings Management Page
 * View and manage Letgo listings created by automated tasks
 */

'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { apiClient, Listing } from '@/lib/api-client'

const statusIcons = {
  active: CheckCircle,
  inactive: XCircle,
  draft: Clock,
  expired: AlertCircle,
}

const statusColors = {
  active: 'text-green-500',
  inactive: 'text-gray-400',
  draft: 'text-yellow-500',
  expired: 'text-red-500',
}

const statusVariants = {
  active: 'default' as const,
  inactive: 'secondary' as const,
  draft: 'outline' as const,
  expired: 'destructive' as const,
}

export default function ListingsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [listingToDelete, setListingToDelete] = useState<Listing | null>(null)

  // Fetch listings
  const { data: listingsData, isLoading } = useQuery({
    queryKey: ['listings', currentPage, searchTerm],
    queryFn: () => apiClient.getListings(currentPage, 200),
  })



  const listings = listingsData?.data || []
  const totalListings = listingsData?.total || 0

  const filteredListings = listings.filter((listing: Listing) =>
    listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    listing.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (listingId: string) => apiClient.deleteListing(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      setDeleteDialogOpen(false)
      setListingToDelete(null)
      toast.success('Listing deleted successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to delete listing: ' + error.message)
    }
  })

  const handleDelete = (listing: Listing) => {
    setListingToDelete(listing)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (listingToDelete) {
      const listingId = listingToDelete._id || listingToDelete.id
      deleteMutation.mutate(listingId)
    }
  }

  const handleView = (listing: Listing) => {
    if (listing.letgo_url && listing.letgo_url !== 'https://www.letgo.com/item/None') {
      window.open(listing.letgo_url, '_blank')
    } else {
      toast.error('This listing has not been published to Letgo yet')
    }
  }


  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Listings</h1>
            <p className="text-muted-foreground">
              View and manage listings created by automated tasks
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalListings}</div>
              <p className="text-xs text-muted-foreground">All listings created</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {listings.filter((l: Listing) => l.status === 'active').length}
              </div>
              <p className="text-xs text-muted-foreground">Currently published</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {listings.filter((l: Listing) => l.status === 'draft').length}
              </div>
              <p className="text-xs text-muted-foreground">Not yet published</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {listings.filter((l: Listing) => l.status === 'expired' || l.status === 'inactive').length}
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
                placeholder="Search listings by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
        </Card>

        {/* Listings Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Özellikler</TableHead>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading listings...
                    </TableCell>
                  </TableRow>
                ) : filteredListings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No listings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredListings.map((listing: Listing) => {
                    const StatusIcon = statusIcons[listing.status]
                    return (
                      <TableRow key={listing._id || listing.id}>
                        <TableCell className="max-w-[250px]">
                          <div className="space-y-1">
                            <div className="font-medium truncate">{listing.title}</div>
                            <div className="text-sm text-muted-foreground truncate" title={listing.description}>
                              {listing.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`h-4 w-4 ${statusColors[listing.status]}`} />
                            <Badge variant={statusVariants[listing.status]}>
                              {listing.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {listing.category || 'Uncategorized'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            ₺{listing.price?.toLocaleString() || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {listing.technical_specs ? (
                              <span 
                                className="max-w-[100px] inline-block truncate cursor-help" 
                                title={Object.entries(listing.technical_specs).map(([key, value]) => `${key}: ${value}`).join(', ')}
                              >
                                {Object.keys(listing.technical_specs).length} özellik
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-mono">
                            {listing.account_id?.slice(-8) || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {new Date(listing.created_at).toLocaleDateString()}
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
                              <DropdownMenuItem onClick={() => handleView(listing)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View on Letgo
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(listing)}
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Listing</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{listingToDelete?.title}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  )
}