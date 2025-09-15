/**
 * Categories Management Page
 * Browse, manage, and configure Letgo categories
 */

'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Settings,
  Eye
} from 'lucide-react'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'

interface CategoryNode {
  name: string
  name_tr: string
  id: number
  image?: string
  parent?: number
  isLastChild?: boolean
  subcategories?: CategoryNode[]
  attributes?: any[]
  level?: number
}

interface CategoryTreeProps {
  categories: CategoryNode[]
  expandedItems: Set<string>
  onToggle: (id: string) => void
  onSelect: (category: CategoryNode) => void
  selectedCategory?: CategoryNode
}

function CategoryTree({ categories, expandedItems, onToggle, onSelect, selectedCategory }: CategoryTreeProps) {
  return (
    <div className="space-y-1">
      {categories.map((category) => (
        <div key={category.id}>
          <div 
            className={`flex items-center space-x-2 p-2 rounded-lg hover:bg-accent cursor-pointer ${
              selectedCategory?.id === category.id ? 'bg-accent' : ''
            }`}
            onClick={() => onSelect(category)}
          >
            {category.subcategories && category.subcategories.length > 0 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(category.id.toString())
                }}
              >
                {expandedItems.has(category.id.toString()) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            ) : (
              <div className="w-4" />
            )}
            
            {category.subcategories && category.subcategories.length > 0 ? (
              expandedItems.has(category.id.toString()) ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )
            ) : (
              <FileText className="h-4 w-4 text-gray-500" />
            )}
            
            <span className="text-sm font-medium">{category.name}</span>
            
            {category.attributes && category.attributes.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {category.attributes.length} attrs
              </Badge>
            )}
          </div>
          
          {category.subcategories && category.subcategories.length > 0 && expandedItems.has(category.id.toString()) && (
            <div className="ml-6 mt-1">
              <CategoryTree
                categories={category.subcategories}
                expandedItems={expandedItems}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedCategory={selectedCategory}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<CategoryNode>()

  // Fetch category tree
  const { data: categoryTree, isLoading, error } = useQuery({
    queryKey: ['category-tree'],
    queryFn: () => apiClient.getCategoryTree(),
  })

  const categories = categoryTree?.data || []

  const handleToggle = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (expandedItems.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const handleSelectCategory = (category: CategoryNode) => {
    setSelectedCategory(category)
  }

  const handleExpandAll = () => {
    const getAllIds = (cats: CategoryNode[]): string[] => {
      let ids: string[] = []
      cats.forEach(cat => {
        ids.push(cat.id.toString())
        if (cat.subcategories) {
          ids = [...ids, ...getAllIds(cat.subcategories)]
        }
      })
      return ids
    }
    setExpandedItems(new Set(getAllIds(categories)))
  }

  const handleCollapseAll = () => {
    setExpandedItems(new Set())
  }

  const filteredCategories = (cats: CategoryNode[]): CategoryNode[] => {
    if (!searchTerm) return cats
    
    return cats.filter(cat => {
      const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase())
      const hasMatchingChildren = cat.subcategories && filteredCategories(cat.subcategories).length > 0
      return matchesSearch || hasMatchingChildren
    }).map(cat => ({
      ...cat,
      subcategories: cat.subcategories ? filteredCategories(cat.subcategories) : undefined
    }))
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">
              Browse and manage Letgo category structure and attributes
            </p>
          </div>
          <Button className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Category Settings</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
              <Folder className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Top-level categories</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subcategories</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {categories.reduce((acc, cat) => {
                  const countChildren = (c: CategoryNode): number => {
                    let count = c.subcategories ? c.subcategories.length : 0
                    if (c.subcategories) {
                      count += c.subcategories.reduce((sum, child) => sum + countChildren(child), 0)
                    }
                    return count
                  }
                  return acc + countChildren(cat)
                }, 0)}
              </div>
              <p className="text-xs text-muted-foreground">All nested categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Attributes</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {categories.reduce((acc, cat) => {
                  const countWithAttributes = (c: CategoryNode): number => {
                    let count = c.attributes && c.attributes.length > 0 ? 1 : 0
                    if (c.subcategories) {
                      count += c.subcategories.reduce((sum, child) => sum + countWithAttributes(child), 0)
                    }
                    return count
                  }
                  return acc + countWithAttributes(cat)
                }, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Categories with custom fields</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Tree */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Category Tree</CardTitle>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={handleExpandAll}>
                    Expand All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCollapseAll}>
                    Collapse All
                  </Button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {error ? (
                <div className="text-center py-8 text-red-500">
                  Error loading categories: {error.message}
                </div>
              ) : isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading categories...
                </div>
              ) : filteredCategories(categories).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No categories found. API returned {categories.length} categories.
                </div>
              ) : (
                <CategoryTree
                  categories={filteredCategories(categories)}
                  expandedItems={expandedItems}
                  onToggle={handleToggle}
                  onSelect={handleSelectCategory}
                  selectedCategory={selectedCategory}
                />
              )}
            </CardContent>
          </Card>

          {/* Category Details */}
          <Card>
            <CardHeader>
              <CardTitle>Category Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCategory ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{selectedCategory.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ID: {selectedCategory.id} • Parent: {selectedCategory.parent || 'None'}
                    </p>
                  </div>

                  {selectedCategory.attributes && selectedCategory.attributes.length > 0 ? (
                    <div>
                      <h4 className="font-medium mb-2">Attributes</h4>
                      <div className="space-y-2">
                        {selectedCategory.attributes.map((attr: any, index: number) => (
                          <div key={index} className="p-2 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{attr.name || `Attribute ${index + 1}`}</span>
                              <Badge variant="outline">{attr.type || 'text'}</Badge>
                            </div>
                            {attr.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {attr.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No attributes defined for this category
                    </div>
                  )}

                  {selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Subcategories ({selectedCategory.subcategories.length})</h4>
                      <div className="space-y-1">
                        {selectedCategory.subcategories.map((child) => (
                          <div key={child.id} className="flex items-center space-x-2 p-1">
                            <FileText className="h-3 w-3 text-gray-500" />
                            <span className="text-sm">{child.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-4">
                    <Button size="sm" className="flex items-center space-x-2">
                      <Eye className="h-4 w-4" />
                      <span>Preview Payload</span>
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span>Configure</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Select a category to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}