'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Settings, 
  Upload, 
  X, 
  RefreshCw, 
  Package, 
  Tag, 
  DollarSign,
  FileText,
  Image,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle,
  Save,
  Edit,
  Trash2,
  Plus,
  MessageSquare
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ListingTemplateFormProps {
  settings: Record<string, any>
}

export function ListingTemplateForm({ settings }: ListingTemplateFormProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const queryClient = useQueryClient()
  
  // State for viewing/editing mode
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    category: '',
    subcategory: '',
    thirdLevelCategory: '',
    condition: 'used',
    images: [],
    attributes: {},
    autoPublish: false,
    publishInterval: 30,
    maxListingsPerAccount: 5,
    autoReply: '',
  })
  
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch saved templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['listing-templates'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/listings/templates`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      return response.json()
    },
  })

  // Fetch main categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', 'main'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/categories/tree`)
      if (!response.ok) throw new Error('Failed to fetch categories')
      return response.json()
    },
  })

  // Fetch subcategories when category is selected
  const { data: subcategoriesData, isLoading: subcategoriesLoading } = useQuery({
    queryKey: ['categories', 'subcategories', formData.category],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/categories/subcategories/${formData.category}`)
      if (!response.ok) throw new Error('Failed to fetch subcategories')
      return response.json()
    },
    enabled: !!formData.category && /^\d+$/.test(formData.category),
  })

  // Fetch third level categories when subcategory is selected
  const { data: thirdLevelData, isLoading: thirdLevelLoading } = useQuery({
    queryKey: ['categories', 'third-level', formData.subcategory],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/categories/subcategories/${formData.subcategory}`)
      if (!response.ok) throw new Error('Failed to fetch third level categories')
      return response.json()
    },
    enabled: !!formData.subcategory && /^\d+$/.test(formData.subcategory),
  })

  // Fetch category attributes - use final category (third level > subcategory > category)
  const finalCategoryId = formData.thirdLevelCategory || formData.subcategory || formData.category
  const { data: categoryDetailsData, isLoading: categoryDetailsLoading } = useQuery({
    queryKey: ['categories', 'attributes', finalCategoryId],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/api/categories/attributes/${finalCategoryId}`)
      if (!response.ok) throw new Error('Failed to fetch category attributes')
      return response.json()
    },
    enabled: !!finalCategoryId && /^\d+$/.test(finalCategoryId),
  })

  const handleImageUpload = useCallback(async (files: FileList) => {
    setUploading(true)
    const newImages: string[] = []
    
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5MB`)
        continue
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not a valid image file`)
        continue
      }
      
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch(`${apiUrl}/api/listings/images/upload`, {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) throw new Error('Failed to upload image')
        
        const result = await response.json()
        newImages.push(result.url)
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
    
    if (newImages.length > 0) {
      setUploadedImages(prev => [...prev, ...newImages])
      toast.success(`${newImages.length} images uploaded successfully`)
    }
    
    setUploading(false)
  }, [apiUrl])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files)
    }
  }

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    // Validate minimum 2 words in description
    const wordCount = formData.description.trim().split(/\s+/).length
    if (wordCount < 2) {
      toast.error('Description must contain at least 2 words')
      return
    }

    if (!formData.title || !formData.price || !formData.category) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSaving(true)
    
    try {
      // Find category names from the loaded data
      const selectedCategory = categories.find((cat: any) => cat.id.toString() === formData.category)
      const selectedSubcategory = subcategories.find((sub: any) => sub.id.toString() === formData.subcategory)
      
      const templateData = {
        name: 'Default Template',
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price.toString()),
        category_id: formData.category ? parseInt(formData.category) : null,
        category_name: selectedCategory?.name || '',
        subcategory_id: formData.subcategory ? parseInt(formData.subcategory) : null,
        subcategory_name: selectedSubcategory?.name || null,
        final_category_id: parseInt(finalCategoryId),
        attributes: selectedAttributes,
        images: uploadedImages,
        condition: formData.condition,
        city: 'Istanbul',  // Default city for now
        district: '',  // Default empty district
        auto_reply: formData.autoReply || null,
        schedule: {
          auto_publish: formData.autoPublish,
          publish_interval: formData.publishInterval,
          max_per_account: formData.maxListingsPerAccount,
        },
        is_active: true,
      }

      const url = selectedTemplateId 
        ? `${apiUrl}/api/listings/templates/${selectedTemplateId}`
        : `${apiUrl}/api/listings/templates`
        
      const response = await fetch(url, {
        method: selectedTemplateId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      })

      if (!response.ok) {
        throw new Error('Failed to save listing template')
      }

      const result = await response.json()
      toast.success(selectedTemplateId ? 'Template updated successfully' : 'Template saved successfully')
      
      // Refresh templates list
      queryClient.invalidateQueries({ queryKey: ['listing-templates'] })
      
      // Reset form if creating new
      if (!selectedTemplateId) {
        resetForm()
      }
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save listing template')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      const response = await fetch(`${apiUrl}/api/listings/templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete template')
      }

      toast.success('Template deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['listing-templates'] })
      
      if (selectedTemplateId === templateId) {
        resetForm()
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  const loadTemplate = async (template: any) => {
    setSelectedTemplateId(template._id)
    setIsEditing(true)
    
    // Convert category_id to string if it exists, otherwise keep as is
    const categoryValue = template.category_id ? template.category_id.toString() : ''
    const subcategoryValue = template.subcategory_id ? template.subcategory_id.toString() : ''
    
    // Set form data with category values
    setFormData({
      title: template.title || '',
      description: template.description || '',
      price: template.price || 0,
      category: categoryValue,
      subcategory: subcategoryValue,
      thirdLevelCategory: '',
      condition: template.condition || 'used',
      images: template.images || [],
      attributes: template.attributes || {},
      autoPublish: template.schedule?.auto_publish || false,
      publishInterval: template.schedule?.publish_interval || 30,
      maxListingsPerAccount: template.schedule?.max_per_account || 5,
      autoReply: template.auto_reply || '',
    })
    
    setSelectedAttributes(template.attributes || {})
    setUploadedImages(template.images || [])
    
    // Force refresh of queries to ensure categories are loaded
    if (categoryValue) {
      queryClient.invalidateQueries({ queryKey: ['categories', 'subcategories', categoryValue] })
    }
  }

  const resetForm = () => {
    setSelectedTemplateId(null)
    setIsEditing(false)
    setFormData({
      title: '',
      description: '',
      price: 0,
      category: '',
      subcategory: '',
      thirdLevelCategory: '',
      condition: 'used',
      images: [],
      attributes: {},
      autoPublish: false,
      publishInterval: 30,
      maxListingsPerAccount: 5,
      autoReply: '',
    })
    setSelectedAttributes({})
    setUploadedImages([])
  }

  const conditions = [
    { value: 'new', label: 'New' },
    { value: 'used', label: 'Used' },
    { value: 'refurbished', label: 'Refurbished' }
  ]

  const categories = categoriesData?.data || []
  const subcategories = subcategoriesData?.data || []
  const thirdLevelCategories = thirdLevelData?.data || []
  // Handle nested response structure from backend
  const attributes = categoryDetailsData?.data?.data?.attributes || categoryDetailsData?.data?.attributes || []
  
  const templates = templatesData?.templates || []
  const hasTemplates = templates.length > 0

  // If there are saved templates and we're not editing, show the template list
  if (hasTemplates && !isEditing) {
    return (
      <div className="space-y-6">
        {/* Header Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Listing Templates</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your listing templates
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  resetForm()
                  setIsEditing(true)
                }}
                size="sm"
                className="flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create New Template</span>
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Templates List */}
        <div className="grid gap-4">
          {templates.map((template: any) => (
            <Card key={template._id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">{template.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="font-medium">₺{template.price}</span>
                      <Badge variant="secondary">{template.condition}</Badge>
                      {template.category_name && (
                        <Badge variant="outline">{template.category_name}</Badge>
                      )}
                      {template.images?.length > 0 && (
                        <span className="text-muted-foreground">
                          {template.images.length} images
                        </span>
                      )}
                      {template.auto_reply && (
                        <Badge variant="default" className="bg-green-600">
                          Auto Reply
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTemplate(template)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template._id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Show the form (either for creating new or editing existing)
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {selectedTemplateId ? 'Edit Listing Template' : 'Create Listing Template'}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTemplateId 
                    ? 'Update your listing template'
                    : 'Create a template that will be used for all accounts'
                  }
                </p>
              </div>
            </div>
            {hasTemplates && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm()
                  setIsEditing(false)
                }}
              >
                Back to Templates
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Form Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Basic Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Price */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center space-x-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <span>Basic Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="template-title" className="flex items-center space-x-1">
                    <span>Title</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="template-title" 
                    placeholder="e.g., iPhone 14 Pro Max 256GB"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-price" className="flex items-center space-x-2">
                    <DollarSign className="h-3 w-3" />
                    <span>Price (₺)</span>
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="template-price" 
                    type="number"
                    placeholder="45000"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center space-x-2">
                  <FileText className="h-3 w-3" />
                  <span>Description</span>
                  <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground ml-2">(min. 2 words)</span>
                </Label>
                <Textarea 
                  placeholder="Enter detailed product description..."
                  className="min-h-[100px] resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={`${formData.description.trim().split(/\s+/).filter(word => word.length > 0).length >= 2 ? 'text-green-600' : 'text-red-600'}`}>
                    {formData.description.trim().split(/\s+/).filter(word => word.length > 0).length} words
                  </span>
                  <span className="text-muted-foreground">
                    {formData.description.length} characters
                  </span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label className="flex items-center space-x-2">
                  <MessageSquare className="h-3 w-3" />
                  <span>Auto Reply Message</span>
                  <span className="text-xs text-muted-foreground ml-2">(optional)</span>
                </Label>
                <Textarea 
                  placeholder="Enter the automatic reply message for chats related to this listing..."
                  className="min-h-[80px] resize-none"
                  value={formData.autoReply}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoReply: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be automatically sent to users who contact you about this listing
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center space-x-2">
                <Layers className="h-4 w-4 text-gray-500" />
                <span>Category Selection</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Main Category *</Label>
                  <Select
                    value={formData.category || ''}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, category: value, subcategory: '', thirdLevelCategory: '' }))
                      setSelectedAttributes({})
                    }}
                    disabled={categoriesLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={categoriesLoading ? 'Loading...' : 'Select main category'}>
                        {formData.category && categories.find((c: any) => c.id.toString() === formData.category)?.name || ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Subcategory</Label>
                  <Select
                    value={formData.subcategory || ''}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, subcategory: value, thirdLevelCategory: '' }))
                      setSelectedAttributes({})
                    }}
                    disabled={!formData.category || subcategoriesLoading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder={subcategoriesLoading ? 'Loading...' : 'Select subcategory'}>
                        {formData.subcategory && subcategories.find((s: any) => s.id.toString() === formData.subcategory)?.name || ''}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((subcategory: any) => (
                        <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.subcategory && thirdLevelCategories.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Detail Category</Label>
                    <Select
                      value={formData.thirdLevelCategory || ''}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, thirdLevelCategory: value }))
                        setSelectedAttributes({})
                      }}
                      disabled={!formData.subcategory || thirdLevelLoading}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={thirdLevelLoading ? 'Loading...' : 'Select detail category'}>
                          {formData.thirdLevelCategory && thirdLevelCategories.find((t: any) => t.id.toString() === formData.thirdLevelCategory)?.name || ''}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {thirdLevelCategories.map((thirdLevel: any) => (
                          <SelectItem key={thirdLevel.id} value={thirdLevel.id.toString()}>
                            {thirdLevel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Condition *</Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conditions.map(condition => (
                        <SelectItem key={condition.value} value={condition.value}>
                          {condition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dynamic Attributes */}
              {attributes.length > 0 && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3 flex items-center space-x-2">
                    <Settings className="h-3 w-3" />
                    <span>Category Attributes</span>
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {attributes.map((attr: any, index: number) => (
                      <div key={`${attr.slug}-${index}`} className="space-y-2">
                        <Label htmlFor={`attr-${attr.slug}`} className="text-sm">
                          {attr.name}
                          {attr.is_required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {attr.values && attr.values.length > 0 ? (
                          <Select 
                            value={selectedAttributes[attr.slug] || ''}
                            onValueChange={(value) => setSelectedAttributes(prev => ({
                              ...prev,
                              [attr.slug]: value
                            }))}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder={`Select ${attr.name}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {attr.values.map((val: any, valIndex: number) => (
                                <SelectItem key={`${val.slug}-${valIndex}`} value={val.slug}>
                                  {val.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            id={`attr-${attr.slug}`}
                            placeholder={`Enter ${attr.name}`}
                            value={selectedAttributes[attr.slug] || ''}
                            onChange={(e) => setSelectedAttributes(prev => ({
                              ...prev,
                              [attr.slug]: e.target.value
                            }))}
                            className="h-9"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Image Upload */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Image className="h-4 w-4 text-gray-500" />
                  <span>Product Images</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {uploadedImages.length}/10 images
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                } ${uploadedImages.length >= 10 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {uploading ? (
                  <div className="space-y-3">
                    <RefreshCw className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
                    <p className="text-sm font-medium">Uploading images...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-10 w-10 mx-auto text-gray-400" />
                    <div>
                      <p className="text-sm font-medium">Drop images here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF up to 5MB each
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                      className="hidden"
                      id="image-upload"
                      disabled={uploadedImages.length >= 10}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      disabled={uploadedImages.length >= 10}
                    >
                      Select Images
                    </Button>
                  </div>
                )}
              </div>

              {/* Image Preview Grid */}
              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img 
                        src={image.startsWith('/') ? `${apiUrl}${image}` : image} 
                        alt={`Product ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Schedule and Actions */}
        <div className="space-y-6">
          {/* Listing Schedule */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>Publishing Schedule</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label htmlFor="auto-publish" className="text-sm font-normal cursor-pointer">
                  Auto-publish to all accounts
                </Label>
                <Switch 
                  id="auto-publish" 
                  checked={formData.autoPublish}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoPublish: checked }))}
                />
              </div>

              {formData.autoPublish && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="publish-interval" className="text-sm">
                      Interval (minutes)
                    </Label>
                    <Input 
                      id="publish-interval" 
                      type="number"
                      value={formData.publishInterval}
                      onChange={(e) => setFormData(prev => ({ ...prev, publishInterval: parseInt(e.target.value) || 30 }))}
                      min="5"
                      max="1440"
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      Time between each account
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-listings" className="text-sm">
                      Max per account
                    </Label>
                    <Input 
                      id="max-listings" 
                      type="number"
                      value={formData.maxListingsPerAccount}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxListingsPerAccount: parseInt(e.target.value) || 5 }))}
                      min="1"
                      max="20"
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Summary */}
          <Card className="bg-gray-50">
            <CardContent className="pt-6">
              <h4 className="text-sm font-medium mb-3">Template Status</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Title</span>
                  {formData.title ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price</span>
                  {formData.price > 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  {formData.category ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Description</span>
                  {formData.description.trim().split(/\s+/).filter(word => word.length > 0).length >= 2 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Images</span>
                  <span className="text-xs">{uploadedImages.length}/10</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleSubmit} 
              disabled={isSaving}
              className="w-full"
              size="lg"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {selectedTemplateId ? 'Updating Template...' : 'Saving Template...'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {selectedTemplateId ? 'Update Template' : 'Save Template'}
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                if (hasTemplates) {
                  resetForm()
                  setIsEditing(false)
                } else {
                  resetForm()
                }
              }}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}