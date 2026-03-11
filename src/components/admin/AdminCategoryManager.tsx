import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { EmojiPickerComponent } from './EmojiPickerComponent'
import { Plus, Edit2, Archive, Trash2, Search, Filter, Copy, Check } from 'lucide-react'

interface Category {
  id: number
  name: string
  icon: string
  description: string
  status: 'active' | 'archived'
  created_by_admin: boolean
  created_at: string
  updated_at: string
  trainer_count?: number
}

export const AdminCategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active')
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('created_at')
  
  // Form states
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState({
    name: '',
    icon: '🏋️',
    description: ''
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // Dialog states
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number; name?: string }>({ open: false })
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; id?: number; name?: string }>({ open: false })
  const [copiedId, setCopiedId] = useState<number | null>(null)
  
  const { toast } = useToast()

  useEffect(() => {
    loadCategories()
  }, [statusFilter, sortBy])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'admin_category_list',
          status: statusFilter,
          sortBy: sortBy
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        setCategories(data.data || [])
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load categories',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load categories',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNew = () => {
    setFormMode('create')
    setEditingId(null)
    setFormData({ name: '', icon: '🏋️', description: '' })
    setShowForm(true)
  }

  const handleEdit = (category: Category) => {
    setFormMode('edit')
    setEditingId(category.id)
    setFormData({
      name: category.name,
      icon: category.icon,
      description: category.description
    })
    setShowForm(true)
  }

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive'
      })
      return
    }

    try {
      const action = formMode === 'create' ? 'admin_category_create' : 'admin_category_update'
      const payload: any = {
        action,
        ...formData
      }
      
      if (formMode === 'edit' && editingId) {
        payload.id = editingId
      }

      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: formMode === 'create' 
            ? 'Category created successfully' 
            : 'Category updated successfully'
        })
        setShowForm(false)
        loadCategories()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to save category',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save category',
        variant: 'destructive'
      })
    }
  }

  const handleArchive = async () => {
    if (!archiveDialog.id) return

    try {
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'admin_category_archive',
          id: archiveDialog.id
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Category archived successfully'
        })
        setArchiveDialog({ open: false })
        loadCategories()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to archive category',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to archive category',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.id) return

    try {
      const response = await fetch('/api.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({
          action: 'admin_category_delete',
          id: deleteDialog.id
        })
      })

      const data = await response.json()
      if (data.status === 'success') {
        toast({
          title: 'Success',
          description: 'Category deleted successfully'
        })
        setDeleteDialog({ open: false })
        loadCategories()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to delete category',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive'
      })
    }
  }

  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Discipline Categories</h2>
          <p className="text-sm text-muted-foreground">Manage training disciplines and categories</p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{formMode === 'create' ? 'Create New Category' : 'Edit Category'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="cat-name">Category Name</Label>
                <Input
                  id="cat-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Yoga, Boxing, CrossFit"
                  className="bg-input border-border"
                />
              </div>
              <div>
                <Label htmlFor="cat-icon">Icon</Label>
                <EmojiPickerComponent
                  value={formData.icon}
                  onChange={(icon) => setFormData({ ...formData, icon })}
                  placeholder="Select emoji"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="cat-desc">Description</Label>
                <Input
                  id="cat-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the discipline"
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitForm} className="gap-2">
                <Plus className="h-4 w-4" />
                {formMode === 'create' ? 'Create' : 'Update'} Category
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="search" className="text-sm">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-input border-border pl-10"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="status-filter" className="text-sm">Status</Label>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="archived">Archived Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sort-by" className="text-sm">Sort By</Label>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest First</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Categories List */}
      {loading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading categories...
          </CardContent>
        </Card>
      ) : filteredCategories.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            {categories.length === 0 ? 'No categories yet. Create your first one!' : 'No categories match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 flex items-start gap-4">
                    <div className="text-3xl flex-shrink-0">{category.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-lg">{category.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          category.status === 'active' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {category.status === 'active' ? '✓ Active' : '📦 Archived'}
                        </span>
                        {category.created_by_admin && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                            Admin Created
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Used by {category.trainer_count || 0} trainer{(category.trainer_count || 0) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(category.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(category)}
                      className="gap-1"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    {category.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setArchiveDialog({ open: true, id: category.id, name: category.name })}
                        className="gap-1"
                      >
                        <Archive className="h-4 w-4" />
                        <span className="hidden sm:inline">Archive</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteDialog({ open: true, id: category.id, name: category.name })}
                      className="gap-1 border-destructive text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archive Dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => setArchiveDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogTitle>Archive Category?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to archive "{archiveDialog.name}"? Existing trainers can keep this discipline, but it won't be available for new selections.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-yellow-600 hover:bg-yellow-700">
              Archive
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Category?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to permanently delete "{deleteDialog.name}"? This action cannot be undone. The category must not be in use by any trainers.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
