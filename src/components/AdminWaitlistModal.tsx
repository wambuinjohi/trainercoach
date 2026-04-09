import React, { useState, useEffect } from 'react'
import { X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiUrl } from '@/lib/api-config'
import { toast } from '@/hooks/use-toast'

interface WaitlistEntry {
  id: string
  name: string
  email: string
  telephone: string
  is_coach: boolean
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

interface AdminWaitlistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AdminWaitlistModal: React.FC<AdminWaitlistModalProps> = ({ open, onOpenChange }) => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [limit] = useState(10)

  useEffect(() => {
    if (open) {
      fetchCategories()
      fetchWaitlistEntries(0)
    }
  }, [open])

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
        setCategories(Array.isArray(result.data) ? result.data : [])
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchWaitlistEntries = async (page: number = 0) => {
    setLoading(true)
    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'waitlist_get',
          limit,
          offset: page * limit,
        }),
      })

      const result = await response.json()
      if (result.status === 'success') {
        setEntries(result.data || [])
        setTotalCount(result.total || 0)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Failed to fetch waitlist entries:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch waitlist entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (waitlistId: string) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return
    }

    try {
      const apiUrl = getApiUrl()
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'waitlist_delete',
          waitlist_id: waitlistId,
        }),
      })

      const result = await response.json()
      if (result.status === 'success') {
        toast({
          title: 'Success',
          description: 'Entry deleted successfully',
        })
        fetchWaitlistEntries(currentPage)
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to delete entry',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to delete entry:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete entry',
        variant: 'destructive',
      })
    }
  }

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

  const filteredEntries = entries.filter(entry => {
    const matchesCategory = !selectedCategory || entry.category_id === parseInt(selectedCategory)
    const matchesSearch = searchQuery === '' || 
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.email.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Waitlist Entries</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className="text-sm">Search</Label>
              <Input
                id="search"
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(0)
                }}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryFilter" className="text-sm">Filter by Category</Label>
              <select
                id="categoryFilter"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(0)
                }}
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

            <div className="flex items-end gap-2">
              <Button
                onClick={() => fetchWaitlistEntries(currentPage)}
                className="w-full text-sm"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredEntries.length} of {totalCount} total entries
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Coach</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No entries found
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-3">{entry.name}</td>
                      <td className="px-4 py-3 truncate">{entry.email}</td>
                      <td className="px-4 py-3">{entry.telephone}</td>
                      <td className="px-4 py-3">{getCategoryName(entry.category_id)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${entry.is_coach ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>
                          {entry.is_coach ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="inline-flex items-center justify-center p-2 hover:bg-destructive/10 rounded-md transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => fetchWaitlistEntries(currentPage - 1)}
                  disabled={currentPage === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  onClick={() => fetchWaitlistEntries(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AdminWaitlistModal
