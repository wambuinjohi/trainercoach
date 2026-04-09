import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, Download, RefreshCw, Plus, Loader2 } from 'lucide-react'
import { getApiUrl } from '@/lib/api-config'
import { toast } from '@/hooks/use-toast'

interface WaitlistEntry {
  id: string
  name: string
  email: string
  telephone: string
  is_coach: number
  category_id?: number
  status: string
  created_at: string
  updated_at: string
}

interface Category {
  id: number
  name: string
  icon?: string
}

export const WaitingListManager: React.FC = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    telephone: '',
    isCoach: false,
    categoryId: '',
  })

  const pageSize = 10

  const fetchCategories = async () => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_categories' }),
      })

      const result = await response.json()
      if (result.status === 'success' && result.data) {
        const cats = Array.isArray(result.data) ? result.data : []
        setCategories(cats)
        console.log('Categories loaded:', cats)
      } else {
        console.warn('Failed to fetch categories:', result)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  // Helper function to get user type display - handles both string and numeric values
  const getUserTypeDisplay = (isCoach: number | string) => {
    const coachValue = typeof isCoach === 'string' ? parseInt(isCoach, 10) : isCoach
    return coachValue === 1 ? 'Coach' : 'Client'
  }

  // Helper function to check if user is coach - handles both string and numeric values
  const isCoachValue = (isCoach: number | string) => {
    const coachValue = typeof isCoach === 'string' ? parseInt(isCoach, 10) : isCoach
    return coachValue === 1
  }

  // Helper function to get category name from ID
  const getCategoryName = (categoryId?: number | string) => {
    if (!categoryId) return '-'
    // Convert to number for comparison since database might return string
    const numericId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId
    const category = categories.find(c => c.id === numericId)
    if (category) {
      return category.name
    }
    console.warn(`Category not found for ID: ${categoryId}, available categories:`, categories)
    return '-'
  }

  const fetchWaitlist = async (page = 0) => {
    try {
      setLoading(true)
      setError(null)

      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'waitlist_get',
          limit: pageSize,
          offset: page * pageSize,
          sort_by: 'created_at',
          sort_order: 'DESC',
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        // The API wraps the data twice: result.data.data contains the actual array
        const entriesData = result.data?.data || result.data || []
        const data = Array.isArray(entriesData) ? entriesData : []
        setEntries(data)
        setTotalCount(result.data?.total || 0)
        setCurrentPage(page)
      } else {
        setError(result.message || 'Failed to fetch waiting list')
        setEntries([])
      }
    } catch (err) {
      setError('Network error: Unable to fetch waiting list')
      setEntries([])
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchWaitlist(0)
  }, [])

  const handleDelete = async (entryId: string) => {
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'waitlist_delete',
          waitlist_id: entryId,
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        // Refresh the list
        fetchWaitlist(currentPage)
        setDeleteConfirm(null)
      } else {
        setError(result.message || 'Failed to delete entry')
      }
    } catch (err) {
      setError('Network error: Unable to delete entry')
      console.error('Delete error:', err)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isCoach: checked,
    }))
  }

  const handleAddWaitlistEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'waitlist_submit',
          name: formData.name,
          email: formData.email,
          telephone: formData.telephone,
          is_coach: formData.isCoach ? 1 : 0,
          category_id: formData.categoryId ? parseInt(formData.categoryId) : null,
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        toast({
          title: 'Success!',
          description: 'Entry added to waiting list successfully.',
        })

        // Reset form and close dialog
        setFormData({
          name: '',
          email: '',
          telephone: '',
          isCoach: false,
          categoryId: '',
        })
        setAddDialogOpen(false)

        // Refresh the list
        fetchWaitlist(0)
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to add to waiting list. Please try again.',
          variant: 'destructive',
        })
        console.error('API Error:', result.message)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Network error. Please check your connection and try again.',
        variant: 'destructive',
      })
      console.error('Error submitting waitlist form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Email', 'Telephone', 'Category', 'Is Coach', 'Status', 'Joined Date']
    const rows = entries.map(entry => [
      entry.name,
      entry.email,
      entry.telephone,
      getCategoryName(entry.category_id),
      entry.is_coach ? 'Yes' : 'No',
      entry.status,
      new Date(entry.created_at).toLocaleDateString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `waiting_list_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredEntries = entries.filter(entry => {
    const matchesCategory = !selectedCategory || entry.category_id === parseInt(selectedCategory)
    const matchesSearch = searchTerm === '' ||
      entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.telephone.includes(searchTerm)
    return matchesCategory && matchesSearch
  })

  const coachCount = entries.filter(e => isCoachValue(e.is_coach)).length
  const clientCount = entries.filter(e => !isCoachValue(e.is_coach)).length
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total on Waitlist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all pages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Coaches/Trainers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{coachCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Professionals offering services</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{clientCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Looking for trainers</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Waiting List Entries</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="gap-2 bg-trainer-primary hover:bg-trainer-primary/90 text-white"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchWaitlist(currentPage)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadCSV}
              disabled={entries.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background text-foreground text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-trainer-primary"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading waiting list...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries found
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 font-semibold">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold">Category</th>
                      <th className="text-center py-3 px-4 font-semibold">Type</th>
                      <th className="text-center py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Joined</th>
                      <th className="text-center py-3 px-4 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{entry.name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{entry.email}</td>
                        <td className="py-3 px-4 font-mono text-sm">{entry.telephone}</td>
                        <td className="py-3 px-4 text-sm">{getCategoryName(entry.category_id)}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={isCoachValue(entry.is_coach) ? 'default' : 'secondary'}>
                            {getUserTypeDisplay(entry.is_coach)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="capitalize">
                            {entry.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-sm">
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirm(entry.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchWaitlist(currentPage - 1)}
                      disabled={currentPage === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchWaitlist(currentPage + 1)}
                      disabled={currentPage >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this waiting list entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Entry Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Waiting List Entry</DialogTitle>
            <DialogDescription>
              Add a new entry to the waiting list manually
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddWaitlistEntry} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                name="name"
                type="text"
                placeholder="Enter full name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="border-input bg-background"
              />
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                name="email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="border-input bg-background"
              />
            </div>

            {/* Telephone Input */}
            <div className="space-y-2">
              <Label htmlFor="add-telephone">Telephone</Label>
              <Input
                id="add-telephone"
                name="telephone"
                type="tel"
                placeholder="+254 XX XXX XXXX"
                value={formData.telephone}
                onChange={handleInputChange}
                required
                className="border-input bg-background"
              />
            </div>

            {/* Category Select */}
            <div className="space-y-2">
              <Label htmlFor="add-category">Category (Optional)</Label>
              <select
                id="add-category"
                name="categoryId"
                value={formData.categoryId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-trainer-primary"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Type Checkbox */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="add-isCoach"
                checked={formData.isCoach}
                onCheckedChange={handleCheckboxChange}
              />
              <Label htmlFor="add-isCoach" className="text-foreground font-normal cursor-pointer text-sm">
                Coach/Trainer (leave unchecked for Client)
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-trainer-primary hover:bg-trainer-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Entry'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default WaitingListManager
